import { FindingsStore } from '../../../stores/FindingsStore';
import { WorkspaceFinding, HistoryFinding } from '../../../services/interfaces';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * Integration tests for FindingsStore.
 *
 * These tests exercise the pub/sub system and state management without
 * requiring any VS Code APIs or file-system access.
 */
describe('FindingsStore (Integration)', () => {
  let store: FindingsStore;

  const makeWorkspaceFinding = (overrides: Partial<WorkspaceFinding> = {}): WorkspaceFinding => ({
    file: '/workspace/src/config.ts',
    line: 10,
    ruleID: 'aws-access-token',
    secret: 'AKIAIOSFODNN7EXAMPLE',
    ...overrides,
  });

  const makeHistoryFinding = (overrides: Partial<HistoryFinding> = {}): HistoryFinding => ({
    file: 'scripts/deploy.sh',
    line: 3,
    ruleID: 'github-pat',
    secret: 'ghp_XXXX',
    commit: 'abc123',
    author: 'Alice',
    email: 'alice@example.com',
    date: '2024-01-15',
    link: null,
    ...overrides,
  });

  beforeEach(() => {
    store = new FindingsStore();
  });

  // ─── Workspace findings ───────────────────────────────────────────────────

  describe('Workspace findings', () => {
    it('should add and retrieve a single workspace finding', () => {
      const finding = makeWorkspaceFinding();
      store.addWorkspaceFinding('/workspace/src/config.ts', finding);

      const results = store.getWorkspaceFindingsForFile('/workspace/src/config.ts');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(finding);
    });

    it('should add multiple findings for the same file via addWorkspaceFindings', () => {
      const f1 = makeWorkspaceFinding({ line: 1 });
      const f2 = makeWorkspaceFinding({ line: 2 });
      store.addWorkspaceFindings('/workspace/src/config.ts', [f1, f2]);

      expect(store.getWorkspaceFindingsCount('/workspace/src/config.ts')).toBe(2);
    });

    it('should return grouped findings by file path', () => {
      store.addWorkspaceFinding('/workspace/src/a.ts', makeWorkspaceFinding({ file: '/workspace/src/a.ts' }));
      store.addWorkspaceFinding('/workspace/src/b.ts', makeWorkspaceFinding({ file: '/workspace/src/b.ts' }));

      const grouped = store.getGroupedWorkspaceFindings();
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['/workspace/src/a.ts']).toHaveLength(1);
      expect(grouped['/workspace/src/b.ts']).toHaveLength(1);
    });

    it('should clear findings for a specific file only', () => {
      store.addWorkspaceFinding('/workspace/src/a.ts', makeWorkspaceFinding({ file: '/workspace/src/a.ts' }));
      store.addWorkspaceFinding('/workspace/src/b.ts', makeWorkspaceFinding({ file: '/workspace/src/b.ts' }));

      store.clearWorkspaceFindings('/workspace/src/a.ts');

      expect(store.getWorkspaceFindingsForFile('/workspace/src/a.ts')).toHaveLength(0);
      expect(store.getWorkspaceFindingsForFile('/workspace/src/b.ts')).toHaveLength(1);
    });

    it('should clear all workspace findings when no path is provided', () => {
      store.addWorkspaceFinding('/workspace/src/a.ts', makeWorkspaceFinding());
      store.addWorkspaceFinding('/workspace/src/b.ts', makeWorkspaceFinding());

      store.clearWorkspaceFindings();

      expect(store.getWorkspaceFindingsCount()).toBe(0);
    });

    it('should report hasFindings correctly', () => {
      const file = '/workspace/src/config.ts';
      expect(store.hasFindings(file)).toBe(false);
      store.addWorkspaceFinding(file, makeWorkspaceFinding());
      expect(store.hasFindings(file)).toBe(true);
    });

    it('should list files with findings', () => {
      store.addWorkspaceFinding('/workspace/src/a.ts', makeWorkspaceFinding());
      store.addWorkspaceFinding('/workspace/src/b.ts', makeWorkspaceFinding());

      const files = store.getFilesWithFindings();
      expect(files).toContain('/workspace/src/a.ts');
      expect(files).toContain('/workspace/src/b.ts');
    });
  });

  // ─── History findings ─────────────────────────────────────────────────────

  describe('History findings', () => {
    it('should add and retrieve history findings', () => {
      const f = makeHistoryFinding();
      store.addHistoryFinding(f);

      expect(store.getAllHistoryFindings()).toHaveLength(1);
      expect(store.getHistoryFindingsCount()).toBe(1);
    });

    it('should add multiple history findings at once', () => {
      store.addHistoryFindings([makeHistoryFinding(), makeHistoryFinding({ commit: 'def456' })]);
      expect(store.getHistoryFindingsCount()).toBe(2);
    });

    it('should clear all history findings', () => {
      store.addHistoryFinding(makeHistoryFinding());
      store.clearHistoryFindings();
      expect(store.getHistoryFindingsCount()).toBe(0);
    });
  });

  // ─── clearAll ─────────────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('should reset both workspace and history findings', () => {
      store.addWorkspaceFinding('/workspace/src/a.ts', makeWorkspaceFinding());
      store.addHistoryFinding(makeHistoryFinding());

      store.clearAll();

      expect(store.getWorkspaceFindingsCount()).toBe(0);
      expect(store.getHistoryFindingsCount()).toBe(0);
    });
  });

  // ─── Pub/sub ──────────────────────────────────────────────────────────────

  describe('Pub/sub (subscribe / notify)', () => {
    it('should call listener when a workspace finding is added', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.addWorkspaceFinding('/workspace/src/a.ts', makeWorkspaceFinding());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'workspace', filePath: '/workspace/src/a.ts' })
      );
    });

    it('should call listener with workspace-cleared event when clearing a file', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.clearWorkspaceFindings('/workspace/src/a.ts');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'workspace-cleared', filePath: '/workspace/src/a.ts' })
      );
    });

    it('should call listener with workspace-cleared event when clearing all', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.clearWorkspaceFindings();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'workspace-cleared' })
      );
    });

    it('should call listener when a history finding is added', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.addHistoryFinding(makeHistoryFinding());

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'history' })
      );
    });

    it('should call listener with history-cleared event', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.clearHistoryFindings();

      expect(listener).toHaveBeenCalledWith({ type: 'history-cleared' });
    });

    it('should stop delivering events after unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);

      unsubscribe();
      store.addWorkspaceFinding('/workspace/src/a.ts', makeWorkspaceFinding());

      expect(listener).not.toHaveBeenCalled();
    });

    it('setScanning should trigger a workspace-cleared notification', () => {
      const listener = jest.fn();
      store.subscribe(listener);

      store.setScanning(true);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'workspace-cleared' })
      );
      expect(store.isScanning).toBe(true);
    });
  });
});
