import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitleaksExecutor } from '../../../services/GitleaksExecutor';
import { ILogger } from '../../../services/interfaces';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { GitRepositoryError } from '../../../errors/ScanError';

describe('GitleaksExecutor (Integration)', () => {
  let executor: GitleaksExecutor;
  let mockLogger: jest.Mocked<ILogger>;
  let tempDirPath: string;
  let mockSecretFilePath: string;

  beforeAll(() => {
    // Setup temporary directory and mock secret file
    tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gitleaks-test-'));
    mockSecretFilePath = path.join(tempDirPath, 'aws_config.ts');
    
    const fileContent = `
-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA5d... dummy key for testing
-----END RSA PRIVATE KEY-----
    `;
    fs.writeFileSync(mockSecretFilePath, fileContent, 'utf-8');

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    executor = new GitleaksExecutor(mockLogger);
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempDirPath)) {
      fs.rmSync(tempDirPath, { recursive: true, force: true });
    }
  });

  describe('Executable Resolution', () => {
    it('should correctly resolve the gitleaks executable path', () => {
      const execPath = executor.getExecutablePath();
      expect(fs.existsSync(execPath)).toBe(true);
      expect(execPath).toContain('gitleaks_8.30.0_');
    });
  });

  describe('executeSingleFile', () => {
    it('should successfully detect a secret in a dummy file without failing', async () => {
      // Act
      const stdout = await executor.executeSingleFile(mockSecretFilePath);

      // Assert
      expect(stdout).toBeDefined();
      // Parse output, it isn't strictly JSON under normal execution, it's a CLI string
      // Gitleaks outputs findings usually indicating what rule broke or the filename
      expect(stdout.includes('rsa-private-key') || stdout.includes('BEGIN RSA PRIVATE KEY')).toBe(true);
      expect(stdout).toContain('aws_config.ts');
    });

    it('should successfully execute over a file with no secrets and return empty array', async () => {
      // Arrange
      const safeFilePath = path.join(tempDirPath, 'safe.ts');
      fs.writeFileSync(safeFilePath, 'console.log("hello world");', 'utf-8');

      // Act
      const stdout = await executor.executeSingleFile(safeFilePath);

      // Assert
      // Safe file means stdout might be empty or missing any secret indication
      expect(stdout === '' || !stdout.includes('rsa-private-key')).toBe(true);

      // Cleanup
      fs.unlinkSync(safeFilePath);
    });
  });

  describe('executeHistory', () => {
    it('should throw GitRepositoryError when executing history in a non-git directory', async () => {
      // Act & Assert
      // We run in tempDirPath which is not a git repository
      await expect(executor.executeHistory(tempDirPath)).rejects.toThrow(GitRepositoryError);
    });
  });
});
