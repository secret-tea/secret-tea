import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ScanService } from '../../../services/ScanService';
import { FindingsStore } from '../../../stores/FindingsStore';
import { GitleaksExecutor } from '../../../services/GitleaksExecutor';
import { GitleaksOutputParser } from '../../../parsers/GitleaksOutputParser';
import { IDiagnosticsUI, ILogger, WorkspaceFinding } from '../../../services/interfaces';
import { MaskingService } from '../../../services/MaskingService';
import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration tests for ScanService.
 *
 * ScanService orchestrates: GitleaksExecutor → GitleaksOutputParser → FindingsStore.
 * We use a real executor and parser; mock only the VS Code-dependent surfaces
 * (IDiagnosticsUI and MaskingService).
 */
describe('ScanService (Integration)', () => {
  let scanService: ScanService;
  let findingsStore: FindingsStore;
  let executor: GitleaksExecutor;
  let parser: GitleaksOutputParser;
  let mockDiagnosticsUI: jest.Mocked<IDiagnosticsUI>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockMaskingService: jest.Mocked<Partial<MaskingService>>;

  let tempDir: string;
  let secretFilePath: string;
  let cleanFilePath: string;

  beforeAll(() => {
    // Create a temp workspace with one secret file and one clean file
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanservice-test-'));
    secretFilePath = path.join(tempDir, 'private_key.ts');
    cleanFilePath = path.join(tempDir, 'clean.ts');

    // RSA PEM format — reliably detected by Gitleaks "private-key" rule
    fs.writeFileSync(secretFilePath, [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEA2a2rwplBQLzygykEMmYz0+Kcj',
      '3bKBp29SU8Sn77FHiBmSRuuGfNDHHt7lGh9A==',
      '-----END RSA PRIVATE KEY-----',
    ].join('\n'), 'utf-8');

    fs.writeFileSync(cleanFilePath, [
      'export function greet(name: string): string {',
      '  return `Hello, ${name}!`;',
      '}',
    ].join('\n'), 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    findingsStore = new FindingsStore();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn(),
    } as jest.Mocked<ILogger>;

    mockDiagnosticsUI = {
      updateDiagnostics: jest.fn(),
      clearDiagnostics: jest.fn(),
      highlightFindings: jest.fn(),
      dispose: jest.fn(),
    } as jest.Mocked<IDiagnosticsUI>;

    mockMaskingService = {
      isMaskingEnabled: jest.fn(() => true),
    } as jest.Mocked<Partial<MaskingService>>;

    executor = new GitleaksExecutor(mockLogger);
    parser = new GitleaksOutputParser();

    scanService = new ScanService(
      executor,
      parser,
      findingsStore,
      mockDiagnosticsUI,
      mockLogger,
      mockMaskingService as unknown as MaskingService
    );
  });

  // ─── scanFile ────────────────────────────────────────────────────────────

  describe('scanFile', () => {
    it('should populate FindingsStore when a secret file is scanned', async () => {
      const findings: WorkspaceFinding[] = await scanService.scanFile(secretFilePath);

      // Gitleaks should detect at least one secret
      expect(findings.length).toBeGreaterThan(0);

      // Store should have the same findings
      const stored = findingsStore.getWorkspaceFindingsForFile(secretFilePath);
      expect(stored.length).toBeGreaterThan(0);
    });

    it('should leave FindingsStore empty when a clean file is scanned', async () => {
      const findings: WorkspaceFinding[] = await scanService.scanFile(cleanFilePath);

      expect(findings).toHaveLength(0);
      expect(findingsStore.getWorkspaceFindingsForFile(cleanFilePath)).toHaveLength(0);
    });

    it('should clear previous findings for a file before updating', async () => {
      // Seed old findings
      findingsStore.addWorkspaceFinding(secretFilePath, {
        file: secretFilePath, line: 0, ruleID: 'old-rule', secret: 'old-secret'
      });

      await scanService.scanFile(secretFilePath);

      // Old-rule findings should be gone; new real findings should be present
      const stored = findingsStore.getWorkspaceFindingsForFile(secretFilePath);
      expect(stored.every(f => f.ruleID !== 'old-rule')).toBe(true);
    });

    it('should call DiagnosticsUI.updateDiagnostics when secrets are found', async () => {
      await scanService.scanFile(secretFilePath);
      expect(mockDiagnosticsUI.updateDiagnostics).toHaveBeenCalledWith(
        secretFilePath,
        expect.any(Array)
      );
    });

    it('should return an empty array and clear diagnostics for a clean file', async () => {
      await scanService.scanFile(cleanFilePath);
      expect(mockDiagnosticsUI.clearDiagnostics).toHaveBeenCalledWith(cleanFilePath);
    });
  });

  // ─── scanWorkspace ────────────────────────────────────────────────────────

  describe('scanWorkspace', () => {
    it('should detect secrets in a workspace directory containing a secret file', async () => {
      const findings = await scanService.scanWorkspace(tempDir);

      expect(findings.length).toBeGreaterThan(0);
      // At least one finding should reference our secret file
      expect(findings.some(f => f.file.includes('private_key.ts'))).toBe(true);
    });

    it('should group findings by file path in FindingsStore', async () => {
      await scanService.scanWorkspace(tempDir);

      const grouped = findingsStore.getGroupedWorkspaceFindings();
      // The secret file should appear as a key
      const groupedKeys = Object.keys(grouped);
      expect(groupedKeys.some(k => k.includes('private_key.ts'))).toBe(true);
    });

    it('should clear all previous workspace findings before a new scan', async () => {
      // Pre-seed a stale finding
      findingsStore.addWorkspaceFinding('/old/stale/file.ts', {
        file: '/old/stale/file.ts', line: 0, ruleID: 'stale', secret: 'stale'
      });

      await scanService.scanWorkspace(tempDir);

      expect(findingsStore.getWorkspaceFindingsForFile('/old/stale/file.ts')).toHaveLength(0);
    });
  });

  // ─── scanHistory ──────────────────────────────────────────────────────────

  describe('scanHistory', () => {
    it('should return empty array when scanning a non-git directory (Gitleaks exits 0 with stderr)', async () => {
      // Gitleaks detect (history mode) in a non-git dir: exits 0, empty stdout → no findings.
      // GitRepositoryError is only thrown when Gitleaks exits non-zero with the
      // "not a git repository" string in stderr. In this version it exits 0.
      const findings = await scanService.scanHistory(tempDir);
      expect(findings).toHaveLength(0);
    });

    it('should leave FindingsStore history empty after non-git scan', async () => {
      await scanService.scanHistory(tempDir);
      expect(findingsStore.getHistoryFindingsCount()).toBe(0);
    });
  });

  // ─── getFindingsCount / clearAllFindings ──────────────────────────────────

  describe('getFindingsCount', () => {
    it('should return correct count after a file scan', async () => {
      await scanService.scanFile(secretFilePath);
      const { workspace } = scanService.getFindingsCount();
      expect(workspace).toBeGreaterThan(0);
    });
  });

  describe('clearAllFindings', () => {
    it('should reset store and clear diagnostics', async () => {
      await scanService.scanFile(secretFilePath);

      scanService.clearAllFindings();

      expect(scanService.getFindingsCount().workspace).toBe(0);
      expect(mockDiagnosticsUI.clearDiagnostics).toHaveBeenCalled();
    });
  });
});
