import { MaskingService } from '../../../services/MaskingService';
import { FindingsStore } from '../../../stores/FindingsStore';
import { ILogger, WorkspaceFinding } from '../../../services/interfaces';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Mock vscode
// ---------------------------------------------------------------------------
const mockSetDecorations = jest.fn();
const mockActiveTextEditor: any = {
  document: {
    uri: { fsPath: '/active/file.ts' },
    lineCount: 20,
    lineAt: jest.fn((_: number) => ({ text: 'const secret = "supersecret";' })),
  },
  setDecorations: mockSetDecorations,
  selection: null,
  revealRange: jest.fn(),
};

const mockDecorationType = { dispose: jest.fn() };
const mockEditorChangeListeners: Array<(editor: any) => void> = [];
const mockDocChangeListeners: Array<(event: any) => void> = [];

jest.mock('vscode', () => ({
  window: {
    get activeTextEditor() { return mockActiveTextEditor; },
    createTextEditorDecorationType: jest.fn(() => mockDecorationType),
    onDidChangeActiveTextEditor: jest.fn((cb: any) => {
      mockEditorChangeListeners.push(cb);
      return { dispose: jest.fn(() => { mockEditorChangeListeners.length = 0; }) };
    }),
    showInformationMessage: jest.fn(),
  },
  workspace: {
    onDidChangeTextDocument: jest.fn((cb: any) => {
      mockDocChangeListeners.push(cb);
      return { dispose: jest.fn(() => { mockDocChangeListeners.length = 0; }) };
    }),
  },
  Range: jest.fn((sl: number, sc: number, el: number, ec: number) => ({ sl, sc, el, ec })),
  DecorationRangeBehavior: { ClosedClosed: 0 },
}), { virtual: true });

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

function makeWorkspaceFinding(overrides: Partial<WorkspaceFinding> = {}): WorkspaceFinding {
  return {
    file: '/active/file.ts',
    line: 0,
    ruleID: 'generic-api-key',
    secret: 'supersecret',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MaskingService', () => {
  let logger: jest.Mocked<ILogger>;
  let findingsStore: FindingsStore;
  let service: MaskingService;

  beforeEach(() => {
    logger = makeLogger();
    findingsStore = new FindingsStore();
    jest.useFakeTimers();
    service = new MaskingService(logger, findingsStore);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    service.dispose();
  });

  // ── constructor ───────────────────────────────────────────────────────────
  describe('constructor', () => {
    it('should create a TextEditorDecorationType on initialization', () => {
      // Create a fresh instance AFTER clearAllMocks, within the test
      const freshService = new MaskingService(logger, findingsStore);
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled();
      freshService.dispose();
    });

    it('should register onDidChangeActiveTextEditor listener', () => {
      const freshService = new MaskingService(logger, findingsStore);
      expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
      freshService.dispose();
    });

    it('should register onDidChangeTextDocument listener', () => {
      const freshService = new MaskingService(logger, findingsStore);
      expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalled();
      freshService.dispose();
    });
  });

  // ── isMaskingEnabled ──────────────────────────────────────────────────────
  describe('isMaskingEnabled', () => {
    it('should default to true', () => {
      expect(service.isMaskingEnabled()).toBe(true);
    });
  });

  // ── toggleMasking ─────────────────────────────────────────────────────────
  describe('toggleMasking', () => {
    it('should toggle from enabled to disabled', () => {
      service.toggleMasking(); // OFF

      expect(service.isMaskingEnabled()).toBe(false);
    });

    it('should toggle from disabled back to enabled', () => {
      service.toggleMasking(); // OFF
      service.toggleMasking(); // ON

      expect(service.isMaskingEnabled()).toBe(true);
    });

    it('should clear decorations when toggling OFF with an active editor', () => {
      service.toggleMasking(); // OFF

      expect(mockSetDecorations).toHaveBeenCalledWith(mockDecorationType, []);
    });

    it('should show information message when toggling ON', () => {
      service.toggleMasking(); // OFF
      jest.clearAllMocks();
      service.toggleMasking(); // ON

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('ON')
      );
    });

    it('should show information message when toggling OFF', () => {
      service.toggleMasking(); // OFF

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('OFF')
      );
    });
  });

  // ── clearAll ──────────────────────────────────────────────────────────────
  describe('clearAll', () => {
    it('should clear decorations on the active editor', () => {
      service.clearAll();

      expect(mockSetDecorations).toHaveBeenCalledWith(mockDecorationType, []);
    });
  });

  // ── FindingsStore subscription ────────────────────────────────────────────
  describe('FindingsStore subscription', () => {
    it('should update masking (debounced) when a workspace finding is added', () => {
      findingsStore.addWorkspaceFinding(
        '/active/file.ts',
        makeWorkspaceFinding({ file: '/active/file.ts' })
      );

      // Advance timers to trigger debounced masking update
      jest.runAllTimers();

      // setDecorations should have been called with decoration options
      expect(mockSetDecorations).toHaveBeenCalled();
    });

    it('should update masking (debounced) when workspace-cleared event fires', () => {
      findingsStore.clearWorkspaceFindings();
      jest.runAllTimers();

      expect(mockSetDecorations).toHaveBeenCalled();
    });

    it('should NOT update masking when masking is disabled', () => {
      service.toggleMasking(); // OFF
      jest.clearAllMocks();

      findingsStore.addWorkspaceFinding(
        '/active/file.ts',
        makeWorkspaceFinding()
      );
      jest.runAllTimers();

      // setDecorations should only have been called in toggleMasking (to clear), not again
      expect(mockSetDecorations).not.toHaveBeenCalled();
    });
  });

  // ── dispose ───────────────────────────────────────────────────────────────
  describe('dispose', () => {
    it('should dispose the decoration type', () => {
      service.dispose();

      expect(mockDecorationType.dispose).toHaveBeenCalled();
    });
  });
});
