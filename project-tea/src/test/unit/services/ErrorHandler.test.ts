import { ErrorHandler } from '../../../services/ErrorHandler';
import { ILogger, IStatusBarUI } from '../../../services/interfaces';
import {
  ScanError,
  ExecutableNotFoundError,
  GitRepositoryError,
  FileTooLargeError,
  ExecutionError,
  ParseError,
  FileSystemError,
  InvalidStateError,
} from '../../../errors/ScanError';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    createTerminal: jest.fn(() => ({ show: jest.fn(), sendText: jest.fn() })),
  },
  commands: {
    executeCommand: jest.fn(),
  },
  env: {
    openExternal: jest.fn(),
  },
  Uri: {
    parse: jest.fn((url: string) => ({ toString: () => url })),
  },
  version: '1.80.0',
  extensions: {
    getExtension: jest.fn(() => ({ packageJSON: { version: '1.0.0' } })),
  },
}), { virtual: true });

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    show: jest.fn(),
  } as any;
}

function makeStatusBar(): jest.Mocked<IStatusBarUI> {
  return {
    showError: jest.fn(),
    showScanning: jest.fn(),
    showReady: jest.fn(),
    showIdle: jest.fn(),
  } as any;
}

describe('ErrorHandler', () => {
  let logger: jest.Mocked<ILogger>;
  let statusBar: jest.Mocked<IStatusBarUI>;
  let handler: ErrorHandler;

  beforeEach(() => {
    logger = makeLogger();
    statusBar = makeStatusBar();
    handler = new ErrorHandler(logger, statusBar);
    jest.clearAllMocks();
    (vscode.window.showErrorMessage as jest.MockedFunction<any>).mockResolvedValue(undefined);
    (vscode.window.showWarningMessage as jest.MockedFunction<any>).mockResolvedValue(undefined);
    (vscode.window.showInformationMessage as jest.MockedFunction<any>).mockResolvedValue(undefined);
  });
  describe('handle — routing by error type', () => {
    it('should call statusBar.showError and showErrorMessage for ExecutableNotFoundError', () => {
      const error = new ExecutableNotFoundError(['/path/to/binary']);

      handler.handle(error, 'test-context');

      expect(statusBar.showError).toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should call statusBar.showError for InvalidStateError', () => {
      const error = new InvalidStateError('bad state');

      handler.handle(error, 'context');

      expect(statusBar.showError).toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should call showWarningMessage and showError for GitRepositoryError', () => {
      const error = new GitRepositoryError('/my/path');

      handler.handle(error, 'context');

      expect(statusBar.showError).toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should log warn but NOT show notification for FileTooLargeError', () => {
      const error = new FileTooLargeError('/big-file.ts', 200 * 1024 * 1024, 50 * 1024 * 1024);

      handler.handle(error, 'context');

      expect(logger.warn).toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('should call showErrorMessage and showError for ExecutionError', () => {
      const error = new ExecutionError('failed', 'cmd', 1);

      handler.handle(error, 'context');

      expect(statusBar.showError).toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should call showErrorMessage and showError for ParseError', () => {
      const error = new ParseError('bad output', 'raw output');

      handler.handle(error, 'context');

      expect(statusBar.showError).toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should NOT show user notification for common FileSystemError (ENOENT)', () => {
      const cause = new Error('ENOENT: no such file');
      const error = new FileSystemError('not found', '/some/file.ts', cause);

      handler.handle(error, 'context');

      expect(logger.warn).toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('should show warning for non-common FileSystemError', () => {
      const cause = new Error('disk full');
      const error = new FileSystemError('write failed', '/some/file.ts', cause);

      handler.handle(error, 'context');

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should call showWarningMessage for a recoverable ScanError', () => {
      const error = new ScanError('recoverable', undefined, true, 'user message');

      handler.handle(error, 'context');

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should call showErrorMessage for an unexpected (plain) Error', () => {
      const error = new Error('unknown problem');

      handler.handle(error, 'context');

      expect(statusBar.showError).toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should always log error at start of handle', () => {
      handler.handle(new Error('any'), 'ctx');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('handleSilent', () => {
    it('should log error silently without user notification', () => {
      const error = new Error('silent error');

      handler.handleSilent(error, 'background-ctx');

      expect(logger.error).toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('should update status bar for non-recoverable ScanError', () => {
      const error = new ExecutableNotFoundError();

      handler.handleSilent(error, 'ctx');

      expect(statusBar.showError).toHaveBeenCalled();
    });

    it('should NOT update status bar for recoverable ScanError', () => {
      const error = new ScanError('recoverable', undefined, true);

      handler.handleSilent(error, 'ctx');

      expect(statusBar.showError).not.toHaveBeenCalled();
    });
  });

  describe('getUserMessage', () => {
    it('should return ScanError.getUserMessage() for ScanError subclasses', () => {
      const error = new ExecutableNotFoundError();
      const msg = handler.getUserMessage(error);

      expect(msg).toBe(error.getUserMessage());
    });

    it('should return error.message for plain errors', () => {
      const error = new Error('plain message');
      const msg = handler.getUserMessage(error);

      expect(msg).toBe('plain message');
    });
  });

  describe('isRecoverable', () => {
    it('should return false for non-recoverable ScanError', () => {
      const error = new ExecutableNotFoundError();
      expect(handler.isRecoverable(error)).toBe(false);
    });

    it('should return true for recoverable ScanError', () => {
      const error = new GitRepositoryError('/path');
      expect(handler.isRecoverable(error)).toBe(true);
    });

    it('should return true for unknown plain errors (assume recoverable)', () => {
      const error = new Error('unknown');
      expect(handler.isRecoverable(error)).toBe(true);
    });
  });
});
