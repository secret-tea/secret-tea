import { NavigationService } from '../../../services/NavigationService';
import { ILogger } from '../../../services/interfaces';
import {
  FileNavigationError,
  FileNotFoundError,
  WorkspaceNotFoundError,
} from '../../../errors/SidebarErrors';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Mock vscode
// All mocking done inside factory functions to avoid TDZ (module-level
// variables cannot be accessed inside a jest.mock() factory call).
// ---------------------------------------------------------------------------

// We collect references to the mock fns AFTER mock registration via jest.mocked
jest.mock('vscode', () => {
  return {
    Uri: {
      file: jest.fn((p: string) => ({ fsPath: p })),
      parse: jest.fn((u: string) => ({ fsPath: u.replace('file://', '') })),
      joinPath: jest.fn((base: any, ...parts: string[]) => ({
        fsPath: `${base.fsPath}/${parts.join('/')}`,
      })),
    },
    workspace: {
      // workspaceFolders will be replaced per-test via Object.defineProperty
      workspaceFolders: [] as any[],
      fs: {
        stat: jest.fn(),
      },
      openTextDocument: jest.fn(),
    },
    window: {
      showTextDocument: jest.fn(),
      activeTextEditor: null,
      createTextEditorDecorationType: jest.fn(() => ({ dispose: jest.fn() })),
      onDidChangeActiveTextEditor: jest.fn(() => ({ dispose: jest.fn() })),
    },
    Position: jest.fn((line: number, col: number) => ({ line, col })),
    Range: jest.fn((start: any, end: any) => ({ start, end })),
    Selection: jest.fn((start: any, end: any) => ({ start, end })),
    TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
    ViewColumn: { One: 1 },
  };
}, { virtual: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    show: jest.fn(),
  } as any;
}

function mockDocument(lineCount = 10, lineText = '  const secret = "abc";') {
  return {
    lineCount,
    lineAt: jest.fn((_: number) => ({ text: lineText })),
    uri: { fsPath: '/file.ts' },
  };
}

function mockEditor() {
  return {
    selection: null as any,
    revealRange: jest.fn(),
    setDecorations: jest.fn(),
  };
}

function getVscodeMock() {
  return vscode as unknown as {
    Uri: { file: jest.Mock<any>; parse: jest.Mock<any>; joinPath: jest.Mock<any> };
    workspace: {
      workspaceFolders: any[];
      fs: { stat: jest.Mock<any> };
      openTextDocument: jest.Mock<any>;
    };
    window: {
      showTextDocument: jest.Mock<any>;
    };
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('NavigationService', () => {
  let logger: jest.Mocked<ILogger>;
  let service: NavigationService;
  let vm: ReturnType<typeof getVscodeMock>;

  beforeEach(() => {
    logger = makeLogger();
    service = new NavigationService(logger);
    vm = getVscodeMock();
    jest.clearAllMocks();

    // Reset workspace folders
    vm.workspace.workspaceFolders = [];

    // Default: file exists, document and editor return mock objects
    vm.workspace.fs.stat.mockResolvedValue({});
    vm.workspace.openTextDocument.mockResolvedValue(mockDocument());
    vm.window.showTextDocument.mockResolvedValue(mockEditor());
  });

  // ── resolveFileUri — absolute path ────────────────────────────────────────
  describe('absolute file paths', () => {
    it('should call vscode.Uri.file for absolute paths', async () => {
      await service.openFileAtLine('/absolute/path/to/file.ts', 5);

      expect(vm.Uri.file).toHaveBeenCalledWith('/absolute/path/to/file.ts');
    });
  });

  // ── resolveFileUri — file:// URI ──────────────────────────────────────────
  describe('file:// URIs', () => {
    it('should call vscode.Uri.parse for file:// URIs', async () => {
      await service.openFileAtLine('file:///workspace/src/file.ts', 1);

      expect(vm.Uri.parse).toHaveBeenCalledWith('file:///workspace/src/file.ts');
    });
  });

  // ── resolveFileUri — relative paths ──────────────────────────────────────
  describe('relative file paths', () => {
    it('should resolve relative path against provided workspaceFolder', async () => {
      const workspaceFolder = { uri: { fsPath: '/workspace' } } as any;

      await service.openFileAtLine('src/file.ts', 1, workspaceFolder);

      expect(vm.Uri.joinPath).toHaveBeenCalledWith(workspaceFolder.uri, 'src/file.ts');
    });

    it('should fall back to first workspace folder when none is provided', async () => {
      const firstWs = { uri: { fsPath: '/workspace' } } as any;
      vm.workspace.workspaceFolders = [firstWs];

      await service.openFileAtLine('src/file.ts', 1);

      expect(vm.Uri.joinPath).toHaveBeenCalledWith(firstWs.uri, 'src/file.ts');
    });

    it('should throw FileNavigationError wrapping WorkspaceNotFoundError when no workspace is available', async () => {
      vm.workspace.workspaceFolders = [];

      await expect(service.openFileAtLine('src/relative.ts', 1)).rejects.toThrow(FileNavigationError);
    });
  });

  // ── validateFileExists ────────────────────────────────────────────────────
  describe('file existence validation', () => {
    it('should throw FileNavigationError wrapping FileNotFoundError when file does not exist', async () => {
      vm.workspace.fs.stat.mockRejectedValue(new Error('not found'));

      await expect(service.openFileAtLine('/missing/file.ts', 1)).rejects.toThrow(FileNavigationError);
    });
  });

  // ── openAndNavigate ───────────────────────────────────────────────────────
  describe('openAndNavigate', () => {
    it('should open the document and show it in a text editor', async () => {
      await service.openFileAtLine('/absolute/file.ts', 3);

      expect(vm.workspace.openTextDocument).toHaveBeenCalled();
      expect(vm.window.showTextDocument).toHaveBeenCalled();
    });

    it('should clamp line to document bounds (line >= lineCount)', async () => {
      const doc = mockDocument(5); // 5 lines (0–4)
      vm.workspace.openTextDocument.mockResolvedValue(doc);
      const editor = mockEditor();
      vm.window.showTextDocument.mockResolvedValue(editor);

      await service.openFileAtLine('/file.ts', 100);

      const callArgs = vm.window.showTextDocument.mock.calls[0];
      const options = callArgs[1] as any;
      expect(options.selection.start.line).toBe(4);
    });

    it('should log info after successful navigation', async () => {
      await service.openFileAtLine('/file.ts', 1);

      expect(logger.info).toHaveBeenCalled();
    });
  });

  // ── error wrapping ────────────────────────────────────────────────────────
  describe('error wrapping', () => {
    it('should throw FileNavigationError (as FileNotFoundError subclass) when file missing', async () => {
      vm.workspace.fs.stat.mockRejectedValue(new Error('not found'));

      await expect(service.openFileAtLine('/missing.ts', 1)).rejects.toThrow(FileNavigationError);
    });

    it('should wrap unexpected errors in FileNavigationError', async () => {
      vm.workspace.fs.stat.mockResolvedValue({});
      vm.workspace.openTextDocument.mockRejectedValue(new Error('unexpected'));

      await expect(service.openFileAtLine('/file.ts', 1)).rejects.toThrow(FileNavigationError);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
