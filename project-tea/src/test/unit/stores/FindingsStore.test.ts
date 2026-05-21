import { FindingsStore, FindingsEvent } from '../../../stores/FindingsStore';
import { WorkspaceFinding, HistoryFinding } from '../../../services/interfaces';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FindingsStore', () => {
  let store: FindingsStore;

  beforeEach(() => {
    store = new FindingsStore();
  });

  // ── Workspace findings ────────────────────────────────────────────────────
  describe('workspace findings', () => {
    it('should start empty', () => {
      expect(store.getAllWorkspaceFindings()).toEqual([]);
      expect(store.getWorkspaceFindingsCount()).toBe(0);
    });

    it('addWorkspaceFinding: adds a single finding for a file', () => {
      const finding = makeWorkspaceFinding({ file: 'a.ts' });
      store.addWorkspaceFinding('a.ts', finding);

      expect(store.getWorkspaceFindingsForFile('a.ts')).toEqual([finding]);
      expect(store.getWorkspaceFindingsCount()).toBe(1);
    });

    it('addWorkspaceFindings: adds multiple findings for a file', () => {
      const findings = [
        makeWorkspaceFinding({ secret: 's1' }),
        makeWorkspaceFinding({ secret: 's2' }),
      ];
      store.addWorkspaceFindings('a.ts', findings);

      expect(store.getWorkspaceFindingsForFile('a.ts')).toHaveLength(2);
    });

    it('getWorkspaceFindingsForFile: returns [] for unknown file', () => {
      expect(store.getWorkspaceFindingsForFile('unknown.ts')).toEqual([]);
    });

    it('getWorkspaceFindingsCount: returns count for specific file', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding({ file: 'a.ts' }));
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding({ file: 'a.ts', secret: 's2' }));
      store.addWorkspaceFinding('b.ts', makeWorkspaceFinding({ file: 'b.ts' }));

      expect(store.getWorkspaceFindingsCount('a.ts')).toBe(2);
      expect(store.getWorkspaceFindingsCount('b.ts')).toBe(1);
      expect(store.getWorkspaceFindingsCount()).toBe(3);
    });

    it('clearWorkspaceFindings: clears findings for a specific file only', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding({ file: 'a.ts' }));
      store.addWorkspaceFinding('b.ts', makeWorkspaceFinding({ file: 'b.ts' }));

      store.clearWorkspaceFindings('a.ts');

      expect(store.getWorkspaceFindingsForFile('a.ts')).toEqual([]);
      expect(store.getWorkspaceFindingsCount('b.ts')).toBe(1);
    });

    it('clearWorkspaceFindings: clears all findings when no arg given', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding());
      store.addWorkspaceFinding('b.ts', makeWorkspaceFinding());

      store.clearWorkspaceFindings();

      expect(store.getAllWorkspaceFindings()).toEqual([]);
    });

    it('getAllWorkspaceFindings: returns findings across all files', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding({ file: 'a.ts', secret: 's1' }));
      store.addWorkspaceFinding('b.ts', makeWorkspaceFinding({ file: 'b.ts', secret: 's2' }));

      const all = store.getAllWorkspaceFindings();
      expect(all).toHaveLength(2);
    });
  });

  // ── History findings ──────────────────────────────────────────────────────
  describe('history findings', () => {
    it('should start empty', () => {
      expect(store.getAllHistoryFindings()).toEqual([]);
      expect(store.getHistoryFindingsCount()).toBe(0);
    });

    it('addHistoryFinding: adds a single finding', () => {
      const finding = makeHistoryFinding();
      store.addHistoryFinding(finding);

      expect(store.getAllHistoryFindings()).toEqual([finding]);
      expect(store.getHistoryFindingsCount()).toBe(1);
    });

    it('addHistoryFindings: adds multiple findings', () => {
      const findings = [makeHistoryFinding({ secret: 's1' }), makeHistoryFinding({ secret: 's2' })];
      store.addHistoryFindings(findings);

      expect(store.getHistoryFindingsCount()).toBe(2);
    });

    it('clearHistoryFindings: removes all history findings', () => {
      store.addHistoryFinding(makeHistoryFinding());
      store.clearHistoryFindings();

      expect(store.getAllHistoryFindings()).toEqual([]);
    });
  });

  // ── Subscription / notifications ──────────────────────────────────────────
  describe('subscribe / notifications', () => {
    it('should notify listener when a workspace finding is added', () => {
      const listener = jest.fn<(event: FindingsEvent) => void>();
      store.subscribe(listener);

      const finding = makeWorkspaceFinding({ file: 'a.ts' });
      store.addWorkspaceFinding('a.ts', finding);

      expect(listener).toHaveBeenCalledWith({
        type: 'workspace',
        filePath: 'a.ts',
        finding,
      });
    });

    it('should notify listener with workspace-cleared when clearWorkspaceFindings is called', () => {
      const listener = jest.fn<(event: FindingsEvent) => void>();
      store.subscribe(listener);

      store.clearWorkspaceFindings();

      expect(listener).toHaveBeenCalledWith({ type: 'workspace-cleared' });
    });

    it('should notify listener with history-cleared when clearHistoryFindings is called', () => {
      const listener = jest.fn<(event: FindingsEvent) => void>();
      store.subscribe(listener);

      store.clearHistoryFindings();

      expect(listener).toHaveBeenCalledWith({ type: 'history-cleared' });
    });

    it('should NOT notify after unsubscribing', () => {
      const listener = jest.fn<(event: FindingsEvent) => void>();
      const unsubscribe = store.subscribe(listener);
      unsubscribe();

      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding());

      expect(listener).not.toHaveBeenCalled();
    });

    it('setScanning: fires workspace-cleared event', () => {
      const listener = jest.fn<(event: FindingsEvent) => void>();
      store.subscribe(listener);

      store.setScanning(true);

      expect(listener).toHaveBeenCalledWith({ type: 'workspace-cleared' });
    });
  });

  // ── Utility methods ───────────────────────────────────────────────────────
  describe('utility methods', () => {
    it('hasFindings: returns true when file has findings', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding({ file: 'a.ts' }));
      expect(store.hasFindings('a.ts')).toBe(true);
    });

    it('hasFindings: returns false for unknown file', () => {
      expect(store.hasFindings('unknown.ts')).toBe(false);
    });

    it('getFilesWithFindings: returns list of file paths that have findings', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding({ file: 'a.ts' }));
      store.addWorkspaceFinding('b.ts', makeWorkspaceFinding({ file: 'b.ts' }));

      const files = store.getFilesWithFindings();
      expect(files).toContain('a.ts');
      expect(files).toContain('b.ts');
    });

    it('getGroupedWorkspaceFindings: groups findings by filePath', () => {
      const f1 = makeWorkspaceFinding({ file: 'a.ts', secret: 's1' });
      const f2 = makeWorkspaceFinding({ file: 'b.ts', secret: 's2' });
      store.addWorkspaceFinding('a.ts', f1);
      store.addWorkspaceFinding('b.ts', f2);

      const grouped = store.getGroupedWorkspaceFindings();
      expect(grouped['a.ts']).toEqual([f1]);
      expect(grouped['b.ts']).toEqual([f2]);
    });

    it('getGroupedWorkspaceFindings: excludes files with no findings (after clear)', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding({ file: 'a.ts' }));
      store.clearWorkspaceFindings('a.ts');

      const grouped = store.getGroupedWorkspaceFindings();
      expect(grouped['a.ts']).toBeUndefined();
    });

    it('clearAll: clears both workspace and history findings', () => {
      store.addWorkspaceFinding('a.ts', makeWorkspaceFinding());
      store.addHistoryFinding(makeHistoryFinding());

      store.clearAll();

      expect(store.getAllWorkspaceFindings()).toEqual([]);
      expect(store.getAllHistoryFindings()).toEqual([]);
    });
  });
});
