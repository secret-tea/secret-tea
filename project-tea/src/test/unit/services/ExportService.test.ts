import * as fs from 'fs';
import { ExportService } from '../../../services/ExportService';
import { WorkspaceFinding, HistoryFinding } from '../../../services/interfaces';
import { MalwareVulnerability } from '../../../stores/MalwareStore';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PassThrough } from 'stream';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
  },
  window: {
    showSaveDialog: jest.fn(),
  },
}), { virtual: true });

// Mock fs
jest.mock('fs', () => {
  const original = jest.requireActual('fs') as object;
  return {
    ...original,
    promises: {
      writeFile: jest.fn(),
    },
    createWriteStream: jest.fn(() => new PassThrough()),
  };
});

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
    jest.clearAllMocks();
  });

  describe('exportSecretsToJson', () => {
    it('should correctly format and save workspace and history findings to a JSON file', async () => {
      // Arrange
      const mockUri = { fsPath: '/mock/path/secrets.json' } as any;
      const workspaceFindings: WorkspaceFinding[] = [
        { file: 'src/config.ts', line: 10, ruleID: 'generic-api-key', secret: 'abc123secret' },
      ];
      const historyFindings: HistoryFinding[] = [
        { file: 'src/old_config.ts', line: 5, ruleID: 'aws-key', secret: 'AKIAIOSFODNN7EXAMPLE', commit: 'abcdef1', author: 'Test User', email: 'test@example.com', date: '2023-01-01', link: 'http://git/commit' },
      ];

      // Act
      await exportService.exportSecretsToJson(workspaceFindings, historyFindings, mockUri);

      // Assert
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
      const [path, data, encoding] = (fs.promises.writeFile as jest.Mock).mock.calls[0] as [string, string, string];
      
      expect(path).toBe('/mock/path/secrets.json');
      expect(encoding).toBe('utf8');
      
      const parsedData = JSON.parse(data);
      expect(parsedData.workspaceFindings).toEqual(workspaceFindings);
      expect(parsedData.historyFindings).toEqual(historyFindings);
      expect(parsedData.generatedAt).toBeDefined();
    });
  });

  describe('exportWorkspaceSecretsToCsv', () => {
    it('should correctly format workspace findings to a CSV file', async () => {
      // Arrange
      const mockUri = { fsPath: '/mock/path/workspace.csv' } as any;
      const workspaceFindings: WorkspaceFinding[] = [
        { file: 'src/config.ts', line: 10, ruleID: 'generic-api-key', secret: 'abc,123' },
      ];

      // Act
      await exportService.exportWorkspaceSecretsToCsv(workspaceFindings, mockUri);

      // Assert
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
      const [path, data, encoding] = (fs.promises.writeFile as jest.Mock).mock.calls[0] as [string, string, string];

      expect(path).toBe('/mock/path/workspace.csv');
      expect(encoding).toBe('utf-8');

      const expectedCsv = `file,line,ruleID,secret\r\nsrc/config.ts,10,generic-api-key,"abc,123"`;
      expect(data).toBe(expectedCsv);
    });
  });

  describe('exportMalwareToCsv', () => {
    it('should correctly format malware vulnerabilities to a CSV file', async () => {
      // Arrange
      const mockUri = { fsPath: '/mock/path/malware.csv' } as any;
      const vulnerabilities: MalwareVulnerability[] = [
        { packageName: 'malicious-pkg', version: '1.0.0', reason: 'Known malicious', filePath: 'node_modules/malicious-pkg' }
      ];

      // Act
      await exportService.exportMalwareToCsv(vulnerabilities, mockUri);

      // Assert
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
      const [path, data, encoding] = (fs.promises.writeFile as jest.Mock).mock.calls[0] as [string, string, string];

      expect(path).toBe('/mock/path/malware.csv');
      expect(encoding).toBe('utf-8');

      const expectedCsv = `Package,Version,Reason,File\r\nmalicious-pkg,1.0.0,Known malicious,node_modules/malicious-pkg`;
      expect(data).toBe(expectedCsv);
    });
  });

  describe('exportSecretsToPdf', () => {
    it('should correctly generate PDF bytes for generic secrets and resolve', async () => {
      // Arrange
      const mockUri = { fsPath: '/mock/path/secrets.pdf' } as any;
      const workspaceFindings: WorkspaceFinding[] = [
        { file: 'src/config.ts', line: 10, ruleID: 'generic-api-key', secret: 'abc123secret' },
      ];
      const historyFindings: HistoryFinding[] = [];

      // Act
      await exportService.exportSecretsToPdf(workspaceFindings, historyFindings, mockUri);

      // Assert
      expect(fs.createWriteStream).toHaveBeenCalledWith('/mock/path/secrets.pdf');
    });
  });

  describe('exportMalwareToPdf', () => {
    it('should correctly generate PDF bytes for malware vulnerabilities', async () => {
      // Arrange
      const mockUri = { fsPath: '/mock/path/malware.pdf' } as any;
      const vulnerabilities: MalwareVulnerability[] = [
        { packageName: 'malicious-pkg', version: '1.0.0', reason: 'Known malicious', filePath: 'node_modules/malicious-pkg' }
      ];

      // Act
      await exportService.exportMalwareToPdf(vulnerabilities, mockUri);

      // Assert
      expect(fs.createWriteStream).toHaveBeenCalledWith('/mock/path/malware.pdf');
    });
  });

  describe('promptSaveLocation', () => {
    it('should invoke vscode window save dialog and return uri', async () => {
      // Arrange
      const mockUri = { fsPath: '/test/path' };
      (vscode.window.showSaveDialog as jest.Mock<any>).mockResolvedValue(mockUri);

      // Act
      const result = await exportService.promptSaveLocation('test.json', { 'JSON': ['json'] });

      // Assert
      expect(vscode.window.showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({
        defaultUri: expect.objectContaining({ fsPath: 'test.json' }),
        filters: { 'JSON': ['json'] }
      }));
      expect(result).toBe(mockUri);
    });
  });
});
