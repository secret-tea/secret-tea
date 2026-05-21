import { ScanService } from '../../../services/ScanService';
import { IGitleaksExecutor, ILogger, IOutputParser, IDiagnosticsUI, WorkspaceFinding, HistoryFinding } from '../../../services/interfaces';
import { FindingsStore } from '../../../stores/FindingsStore';
import { MaskingService } from '../../../services/MaskingService';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// MaskingService depends on vscode — mock the entire module
// ---------------------------------------------------------------------------
jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null,
    createTextEditorDecorationType: jest.fn(() => ({ dispose: jest.fn() })),
    onDidChangeActiveTextEditor: jest.fn(() => ({ dispose: jest.fn() })),
    showInformationMessage: jest.fn(),
  },
  workspace: {
    onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  },
}), { virtual: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeWorkspaceFinding = (overrides: Partial<WorkspaceFinding> = {}): WorkspaceFinding => ({
  file: 'src/config.ts',
  line: 10,
  ruleID: 'generic-api-key',
  secret: 'supersecret',
  ...overrides,
});

const makeHistoryFinding = (overrides: Partial<HistoryFinding> = {}): HistoryFinding => ({
  file: 'src/old.ts',
  line: 5,
  ruleID: 'aws-key',
  secret: 'AKIA123',
  commit: 'abc123',
  author: 'Dev',
  email: 'dev@dev.com',
  date: '2023-01-01',
  link: null,
  ...overrides,
});

function makeLogger(): jest.Mocked<ILogger> {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), show: jest.fn() } as any;
}

function makeExecutor(): jest.Mocked<IGitleaksExecutor> {
  return {
    executeSingleFile: jest.fn(),
    executeWorkspace: jest.fn(),
    executeHistory: jest.fn(),
    getExecutablePath: jest.fn(),
  } as any;
}

function makeParser(): jest.Mocked<IOutputParser> {
  return {
    parseWorkspaceScan: jest.fn(),
    parseHistoryScan: jest.fn(),
  } as any;
}

function makeDiagnosticsUI(): jest.Mocked<IDiagnosticsUI> {
  return {
    updateDiagnostics: jest.fn(),
    clearDiagnostics: jest.fn(),
    highlightFindings: jest.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ScanService', () => {
  let executor: jest.Mocked<IGitleaksExecutor>;
  let parser: jest.Mocked<IOutputParser>;
  let findingsStore: FindingsStore;
  let diagnosticsUI: jest.Mocked<IDiagnosticsUI>;
  let logger: jest.Mocked<ILogger>;
  let maskingService: MaskingService;
  let service: ScanService;

  beforeEach(() => {
    executor = makeExecutor();
    parser = makeParser();
    findingsStore = new FindingsStore();
    diagnosticsUI = makeDiagnosticsUI();
    logger = makeLogger();
    maskingService = new MaskingService(logger, findingsStore);
    service = new ScanService(executor, parser, findingsStore, diagnosticsUI, logger, maskingService);
    jest.clearAllMocks();
  });

  // ── scanFile ──────────────────────────────────────────────────────────────
  describe('scanFile', () => {
    it('should execute scan, parse output, and return findings', async () => {
      const findings = [makeWorkspaceFinding({ file: 'src/config.ts' })];
      executor.executeSingleFile.mockResolvedValue('raw output');
      parser.parseWorkspaceScan.mockReturnValue(findings);

      const result = await service.scanFile('src/config.ts');

      expect(executor.executeSingleFile).toHaveBeenCalledWith('src/config.ts');
      expect(parser.parseWorkspaceScan).toHaveBeenCalledWith('raw output');
      expect(result).toEqual(findings);
    });

    it('should clear old findings for the file before adding new ones', async () => {
      const finding = makeWorkspaceFinding({ file: 'src/config.ts' });
      findingsStore.addWorkspaceFinding('src/config.ts', finding);

      executor.executeSingleFile.mockResolvedValue('');
      parser.parseWorkspaceScan.mockReturnValue([]);

      await service.scanFile('src/config.ts');

      expect(findingsStore.getWorkspaceFindingsForFile('src/config.ts')).toEqual([]);
    });

    it('should update store and diagnostics when findings are found', async () => {
      const findings = [makeWorkspaceFinding({ file: 'a.ts' })];
      executor.executeSingleFile.mockResolvedValue('raw');
      parser.parseWorkspaceScan.mockReturnValue(findings);

      await service.scanFile('a.ts');

      expect(findingsStore.getWorkspaceFindingsForFile('a.ts')).toEqual(findings);
      expect(diagnosticsUI.updateDiagnostics).toHaveBeenCalledWith('a.ts', findings);
      expect(diagnosticsUI.highlightFindings).toHaveBeenCalledWith('a.ts', findings);
    });

    it('should NOT update store when no findings are returned', async () => {
      executor.executeSingleFile.mockResolvedValue('');
      parser.parseWorkspaceScan.mockReturnValue([]);

      await service.scanFile('clean.ts');

      expect(findingsStore.getWorkspaceFindingsCount('clean.ts')).toBe(0);
      expect(diagnosticsUI.updateDiagnostics).not.toHaveBeenCalled();
    });

    it('should propagate errors from the executor', async () => {
      executor.executeSingleFile.mockRejectedValue(new Error('scan failed'));

      await expect(service.scanFile('bad.ts')).rejects.toThrow('scan failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ── scanWorkspace ─────────────────────────────────────────────────────────
  describe('scanWorkspace', () => {
    it('should execute workspace scan and return all findings', async () => {
      const findings = [
        makeWorkspaceFinding({ file: 'a.ts' }),
        makeWorkspaceFinding({ file: 'b.ts' }),
      ];
      executor.executeWorkspace.mockResolvedValue('raw');
      parser.parseWorkspaceScan.mockReturnValue(findings);

      const result = await service.scanWorkspace('/workspace');

      expect(executor.executeWorkspace).toHaveBeenCalledWith('/workspace');
      expect(result).toEqual(findings);
    });

    it('should group findings by file and update store per file', async () => {
      const findings = [
        makeWorkspaceFinding({ file: 'a.ts', secret: 's1' }),
        makeWorkspaceFinding({ file: 'a.ts', secret: 's2' }),
        makeWorkspaceFinding({ file: 'b.ts', secret: 's3' }),
      ];
      executor.executeWorkspace.mockResolvedValue('raw');
      parser.parseWorkspaceScan.mockReturnValue(findings);

      await service.scanWorkspace('/workspace');

      expect(findingsStore.getWorkspaceFindingsCount('a.ts')).toBe(2);
      expect(findingsStore.getWorkspaceFindingsCount('b.ts')).toBe(1);
    });

    it('should clear all existing findings before the scan', async () => {
      findingsStore.addWorkspaceFinding('old.ts', makeWorkspaceFinding({ file: 'old.ts' }));

      executor.executeWorkspace.mockResolvedValue('');
      parser.parseWorkspaceScan.mockReturnValue([]);

      await service.scanWorkspace('/workspace');

      expect(findingsStore.getAllWorkspaceFindings()).toEqual([]);
    });

    it('should propagate errors from the executor', async () => {
      executor.executeWorkspace.mockRejectedValue(new Error('failed'));

      await expect(service.scanWorkspace('/ws')).rejects.toThrow('failed');
    });
  });

  // ── scanHistory ───────────────────────────────────────────────────────────
  describe('scanHistory', () => {
    it('should execute history scan and store findings', async () => {
      const findings = [makeHistoryFinding({ file: '/workspace/src/a.ts' })];
      executor.executeHistory.mockResolvedValue('raw');
      parser.parseHistoryScan.mockReturnValue(findings);

      const result = await service.scanHistory('/workspace');

      expect(executor.executeHistory).toHaveBeenCalledWith('/workspace');
      expect(result).toHaveLength(1);
    });

    it('should strip workspace path prefix from file paths', async () => {
      const findings = [makeHistoryFinding({ file: '/workspace/src/a.ts' })];
      executor.executeHistory.mockResolvedValue('raw');
      parser.parseHistoryScan.mockReturnValue(findings);

      const result = await service.scanHistory('/workspace');

      expect(result[0].file).toBe('src/a.ts');
    });

    it('should NOT strip path if file does not start with workspace path', async () => {
      const findings = [makeHistoryFinding({ file: 'src/relative.ts' })];
      executor.executeHistory.mockResolvedValue('raw');
      parser.parseHistoryScan.mockReturnValue(findings);

      const result = await service.scanHistory('/workspace');

      expect(result[0].file).toBe('src/relative.ts');
    });

    it('should clear old history findings before storing new ones', async () => {
      findingsStore.addHistoryFinding(makeHistoryFinding({ commit: 'old' }));

      executor.executeHistory.mockResolvedValue('');
      parser.parseHistoryScan.mockReturnValue([]);

      await service.scanHistory('/workspace');

      expect(findingsStore.getAllHistoryFindings()).toEqual([]);
    });
  });

  // ── getFindingsCount ──────────────────────────────────────────────────────
  describe('getFindingsCount', () => {
    it('should return count from the store', async () => {
      findingsStore.addWorkspaceFinding('a.ts', makeWorkspaceFinding());
      findingsStore.addHistoryFinding(makeHistoryFinding());

      const counts = service.getFindingsCount();

      expect(counts.workspace).toBe(1);
      expect(counts.history).toBe(1);
    });
  });

  // ── clearAllFindings ──────────────────────────────────────────────────────
  describe('clearAllFindings', () => {
    it('should clear store and diagnostics', () => {
      findingsStore.addWorkspaceFinding('a.ts', makeWorkspaceFinding());

      service.clearAllFindings();

      expect(findingsStore.getAllWorkspaceFindings()).toEqual([]);
      expect(diagnosticsUI.clearDiagnostics).toHaveBeenCalled();
    });
  });
});
