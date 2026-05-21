import * as fs from 'fs';
import * as childProcess from 'child_process';
import { GitleaksExecutor } from '../../../services/GitleaksExecutor';
import { ILogger } from '../../../services/interfaces';
import { ExecutableNotFoundError, ExecutionError, GitRepositoryError } from '../../../errors/ScanError';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.mock('fs', () => {
  const original = jest.requireActual('fs') as object;
  return {
    ...original,
    existsSync: jest.fn(),
  };
});

// We mock child_process.exec (the underlying NodeJS function that promisify wraps)
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Type alias so we can easily cast the exec mock
const execMock = () => childProcess.exec as unknown as jest.MockedFunction<(...args: any[]) => any>;

function mockExecSuccess(stdout: string, stderr = ''): void {
  execMock().mockImplementation((_cmd: any, _opts: any, callback: any) => {
    callback(null, { stdout, stderr });
  });
}

function mockExecWithFindings(stdout: string, stderr = ''): void {
  const error: any = new Error('Command failed');
  error.stdout = stdout;
  error.stderr = stderr;
  error.code = 1;

  execMock().mockImplementation((_cmd: any, _opts: any, callback: any) => {
    callback(error, { stdout: '', stderr: '' });
  });
}

function mockExecFailure(message: string, stderr = '', stdout = ''): void {
  const error: any = new Error(message);
  error.stdout = stdout;
  error.stderr = stderr;
  error.code = 2;

  execMock().mockImplementation((_cmd: any, _opts: any, callback: any) => {
    callback(error, { stdout: '', stderr: '' });
  });
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    show: jest.fn(),
  } as any;
}

// Make existsSync return true for the executables path, effectively mocking a found binary
function setupExecutableFound(): void {
  (fs.existsSync as jest.Mock).mockReturnValue(true);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GitleaksExecutor', () => {
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    logger = makeLogger();
    jest.clearAllMocks();
  });

  // ── Constructor / resolveExecutablePath ───────────────────────────────────
  describe('constructor', () => {
    it('should resolve executable from executables/ directory when it exists', () => {
      setupExecutableFound();
      const executor = new GitleaksExecutor(logger);

      expect(executor.getExecutablePath()).toContain('gitleaks_8.30.0_');
    });

    it('should try parent directory when executables/ path is missing', () => {
      // First call (executables/) → false, second call (parent/) → true
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const executor = new GitleaksExecutor(logger);
      expect(executor.getExecutablePath()).toBeTruthy();
    });

    it('should throw ExecutableNotFoundError when neither path exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => new GitleaksExecutor(logger)).toThrow(ExecutableNotFoundError);
    });
  });

  // ── executeSingleFile ─────────────────────────────────────────────────────
  describe('executeSingleFile', () => {
    it('should return stdout on successful execution', async () => {
      setupExecutableFound();
      mockExecSuccess('scan output');
      const executor = new GitleaksExecutor(logger);

      const result = await executor.executeSingleFile('/path/to/file.ts');

      expect(result).toBe('scan output');
    });

    it('should build the correct command with --no-git flag', async () => {
      setupExecutableFound();
      mockExecSuccess('');
      const executor = new GitleaksExecutor(logger);

      await executor.executeSingleFile('/path/to/file.ts');

      const callArgs = execMock().mock.calls[0];
      const command = callArgs[0] as string;
      expect(command).toContain('detect');
      expect(command).toContain('--no-git');
      expect(command).toContain('/path/to/file.ts');
    });

    it('should return stdout when exit code is non-zero but stdout is populated (findings detected)', async () => {
      setupExecutableFound();
      mockExecWithFindings('Finding: AKIAIOSFODNN7');
      const executor = new GitleaksExecutor(logger);

      const result = await executor.executeSingleFile('/file.ts');

      expect(result).toBe('Finding: AKIAIOSFODNN7');
    });

    it('should throw ExecutionError when execution fails with no stdout', async () => {
      setupExecutableFound();
      mockExecFailure('permission denied');
      const executor = new GitleaksExecutor(logger);

      await expect(executor.executeSingleFile('/file.ts')).rejects.toThrow(ExecutionError);
    });
  });

  // ── executeWorkspace ──────────────────────────────────────────────────────
  describe('executeWorkspace', () => {
    it('should build a command with --no-git and the workspace path', async () => {
      setupExecutableFound();
      mockExecSuccess('');
      const executor = new GitleaksExecutor(logger);

      await executor.executeWorkspace('/my/workspace');

      const callArgs = execMock().mock.calls[0];
      const command = callArgs[0] as string;
      expect(command).toContain('--no-git');
      expect(command).toContain('/my/workspace');
    });
  });

  // ── executeHistory ────────────────────────────────────────────────────────
  describe('executeHistory', () => {
    it('should build a history command without --no-git', async () => {
      setupExecutableFound();
      mockExecSuccess('');
      const executor = new GitleaksExecutor(logger);

      await executor.executeHistory('/my/workspace');

      const callArgs = execMock().mock.calls[0];
      const command = callArgs[0] as string;
      expect(command).not.toContain('--no-git');
    });

    it('should set cwd option to the workspace path', async () => {
      setupExecutableFound();
      mockExecSuccess('');
      const executor = new GitleaksExecutor(logger);

      await executor.executeHistory('/my/repo');

      const callArgs = execMock().mock.calls[0];
      const opts = callArgs[1] as any;
      expect(opts.cwd).toBe('/my/repo');
    });
  });

  // ── execute error handling ────────────────────────────────────────────────
  describe('execute error handling', () => {
    it('should throw GitRepositoryError when stderr contains "not a git repository"', async () => {
      setupExecutableFound();
      mockExecFailure('command failed', 'fatal: not a git repository');
      const executor = new GitleaksExecutor(logger);

      await expect(executor.executeHistory('/not/a/repo')).rejects.toThrow(GitRepositoryError);
    });

    it('should log stderr as warning when execution succeeds but stderr is present', async () => {
      setupExecutableFound();
      mockExecSuccess('output', 'some warning on stderr');
      const executor = new GitleaksExecutor(logger);

      await executor.executeSingleFile('/file.ts');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // ── getExecutablePrefix (platform names) ─────────────────────────────────
  describe('executable path includes platform info', () => {
    it('should include the platform name in the resolved path', () => {
      setupExecutableFound();
      const executor = new GitleaksExecutor(logger);
      const path = executor.getExecutablePath();

      // Should contain one of the known platform names
      const knownPlatforms = ['linux', 'darwin', 'windows'];
      expect(knownPlatforms.some(p => path.includes(p))).toBe(true);
    });

    it('should include the architecture in the resolved path', () => {
      setupExecutableFound();
      const executor = new GitleaksExecutor(logger);
      const path = executor.getExecutablePath();

      const knownArchs = ['x64', 'arm64', 'ia32', 'arm'];
      expect(knownArchs.some(a => path.includes(a))).toBe(true);
    });
  });
});
