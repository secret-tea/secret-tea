/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportService } from '../../services/ExportService';
import { WorkspaceFinding, HistoryFinding } from '../../services/interfaces';
import { MalwareVulnerability } from '../../stores/MalwareStore';

/**
 * Integration test suite: Export Service
 *
 * Tests ExportService methods directly (no VS Code command required — the
 * export commands are webview message handlers, so we call the service API).
 * Each test writes to a temp file and validates the produced content.
 *
 * Runs inside a real VS Code instance (needed because ExportService imports vscode).
 */
suite('Export Integration Test Suite', () => {
  let exportService: ExportService;
  let tempDir: string;

  // ─── Fixtures ────────────────────────────────────────────────────────────

  const workspaceFindings: WorkspaceFinding[] = [
    { file: 'src/config.ts', line: 10, ruleID: 'aws-access-token', secret: 'AKIAIOSFODNN7EXAMPLE' },
    { file: 'src/config.ts', line: 20, ruleID: 'github-pat', secret: 'ghp_XXXX' },
  ];

  const historyFindings: HistoryFinding[] = [
    {
      file: 'scripts/deploy.sh',
      line: 5,
      ruleID: 'aws-access-token',
      secret: 'AKIAIOSFODNN7EXAMPLE',
      commit: 'abc123',
      author: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-15',
      link: 'https://github.com/org/repo/commit/abc123',
    },
  ];

  const malwareVulnerabilities: MalwareVulnerability[] = [
    { packageName: 'evil-pkg', version: '1.0.0', reason: 'Malicious code', filePath: 'package-lock.json' },
    { packageName: 'another-evil', version: '2.0.1', reason: 'Data exfiltration', filePath: 'package-lock.json' },
  ];

  // ─── Setup / teardown ─────────────────────────────────────────────────────

  setup(() => {
    exportService = new ExportService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'));
  });

  teardown(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ─── JSON exports ─────────────────────────────────────────────────────────

  test('exportSecretsToJson: should write a valid JSON file with workspaceFindings and historyFindings', async () => {
    const filePath = path.join(tempDir, 'secrets.json');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportSecretsToJson(workspaceFindings, historyFindings, uri);

    assert.ok(fs.existsSync(filePath), 'Output JSON file should exist');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.ok(Array.isArray(content.workspaceFindings), 'Should have workspaceFindings array');
    assert.ok(Array.isArray(content.historyFindings), 'Should have historyFindings array');
    assert.strictEqual(content.workspaceFindings.length, workspaceFindings.length, 'Workspace findings count should match');
    assert.strictEqual(content.historyFindings.length, historyFindings.length, 'History findings count should match');
    assert.ok(typeof content.generatedAt === 'string', 'Should include generatedAt timestamp');
  });

  test('exportMalwareToJson: should write a valid JSON file with malwareFindings', async () => {
    const filePath = path.join(tempDir, 'malware.json');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportMalwareToJson(malwareVulnerabilities, uri);

    assert.ok(fs.existsSync(filePath), 'Output JSON file should exist');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.ok(Array.isArray(content.malwareFindings), 'Should have malwareFindings array');
    assert.strictEqual(content.malwareFindings.length, malwareVulnerabilities.length, 'Malware findings count should match');
  });

  // ─── CSV exports ─────────────────────────────────────────────────────────

  test('exportWorkspaceSecretsToCsv: should produce CSV with correct header row', async () => {
    const filePath = path.join(tempDir, 'workspace-secrets.csv');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportWorkspaceSecretsToCsv(workspaceFindings, uri);

    assert.ok(fs.existsSync(filePath), 'CSV file should exist');
    const lines = fs.readFileSync(filePath, 'utf-8').split('\r\n');
    assert.strictEqual(lines[0], 'file,line,ruleID,secret', 'Header row should match expected columns');
    assert.strictEqual(lines.length, workspaceFindings.length + 1, 'Should have correct number of data rows');
  });

  test('exportHistorySecretsToCsv: should produce CSV with correct header columns', async () => {
    const filePath = path.join(tempDir, 'history-secrets.csv');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportHistorySecretsToCsv(historyFindings, uri);

    assert.ok(fs.existsSync(filePath), 'CSV file should exist');
    const lines = fs.readFileSync(filePath, 'utf-8').split('\r\n');
    assert.ok(lines[0].includes('file'), 'Header should include "file"');
    assert.ok(lines[0].includes('commit'), 'Header should include "commit"');
    assert.ok(lines[0].includes('author'), 'Header should include "author"');
  });

  test('exportMalwareToCsv: should produce CSV with Package,Version,Reason,File header', async () => {
    const filePath = path.join(tempDir, 'malware.csv');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportMalwareToCsv(malwareVulnerabilities, uri);

    assert.ok(fs.existsSync(filePath), 'CSV file should exist');
    const lines = fs.readFileSync(filePath, 'utf-8').split('\r\n');
    assert.strictEqual(lines[0], 'Package,Version,Reason,File', 'Malware CSV header should match');
  });

  test('exportWorkspaceSecretsToCsv: CSV values should contain finding data', async () => {
    const filePath = path.join(tempDir, 'check-data.csv');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportWorkspaceSecretsToCsv(workspaceFindings, uri);

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('aws-access-token'), 'CSV should contain the ruleID');
    assert.ok(content.includes('src/config.ts'), 'CSV should contain the file path');
  });

  // ─── PDF exports ──────────────────────────────────────────────────────────

  test('exportSecretsToPdf: should write a non-empty PDF file', async () => {
    const filePath = path.join(tempDir, 'secrets.pdf');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportSecretsToPdf(workspaceFindings, historyFindings, uri);

    assert.ok(fs.existsSync(filePath), 'PDF file should exist');
    const stats = fs.statSync(filePath);
    assert.ok(stats.size > 0, 'PDF file should not be empty');
  });

  test('exportMalwareToPdf: should write a non-empty PDF file', async () => {
    const filePath = path.join(tempDir, 'malware.pdf');
    const uri = vscode.Uri.file(filePath);

    await exportService.exportMalwareToPdf(malwareVulnerabilities, uri);

    assert.ok(fs.existsSync(filePath), 'PDF file should exist');
    const stats = fs.statSync(filePath);
    assert.ok(stats.size > 0, 'PDF file should not be empty');
  });
});
