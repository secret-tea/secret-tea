import { HistoryFinding, WorkspaceFinding } from '../services/interfaces';

export type FindingsEvent =
  | { type: 'workspace'; filePath: string; finding: WorkspaceFinding }
  | { type: 'workspace-cleared'; filePath?: string }
  | { type: 'history'; finding: HistoryFinding }
  | { type: 'history-cleared' };

export interface FindingsListener {
  (event: FindingsEvent): void;
}

/**
 * FindingsStore manage secret findings
 */
export class FindingsStore {
  private workspaceFindings = new Map<string, Set<WorkspaceFinding>>();
  private historyFindings = new Set<HistoryFinding>();
  private listeners = new Set<FindingsListener>();

  addWorkspaceFinding(filePath: string, finding: WorkspaceFinding): void {
    if (!this.workspaceFindings.has(filePath)) {
      this.workspaceFindings.set(filePath, new Set());
    }
    this.workspaceFindings.get(filePath)!.add(finding);
    this.notifyListeners({ type: 'workspace', filePath, finding });
  }

  addWorkspaceFindings(filePath: string, findings: WorkspaceFinding[]): void {
    if (!this.workspaceFindings.has(filePath)) {
      this.workspaceFindings.set(filePath, new Set());
    }
    const fileFindings = this.workspaceFindings.get(filePath)!;
    findings.forEach(finding => {
      fileFindings.add(finding);
      this.notifyListeners({ type: 'workspace', filePath, finding });
    });
  }

  getWorkspaceFindingsForFile(filePath: string): WorkspaceFinding[] {
    const findings = this.workspaceFindings.get(filePath);
    return findings ? Array.from(findings) : [];
  }

  getAllWorkspaceFindings(): WorkspaceFinding[] {
    const allFindings: WorkspaceFinding[] = [];
    this.workspaceFindings.forEach(findings => {
      allFindings.push(...Array.from(findings));
    });
    return allFindings;
  }

  getWorkspaceFindingsCount(filePath?: string): number {
    if (filePath) {
      const findings = this.workspaceFindings.get(filePath);
      return findings ? findings.size : 0;
    }
    return this.getAllWorkspaceFindings().length;
  }

  clearWorkspaceFindings(filePath?: string): void {
    if (filePath) {
      this.workspaceFindings.delete(filePath);
      this.notifyListeners({ type: 'workspace-cleared', filePath });
    } else {
      this.workspaceFindings.clear();
      this.notifyListeners({ type: 'workspace-cleared' });
    }
  }

  addHistoryFinding(finding: HistoryFinding): void {
    this.historyFindings.add(finding);
    this.notifyListeners({ type: 'history', finding });
  }

  addHistoryFindings(findings: HistoryFinding[]): void {
    findings.forEach(finding => {
      this.historyFindings.add(finding);
      this.notifyListeners({ type: 'history', finding });
    });
  }

  getAllHistoryFindings(): HistoryFinding[] {
    return Array.from(this.historyFindings);
  }

  getHistoryFindingsCount(): number {
    return this.historyFindings.size;
  }

  clearHistoryFindings(): void {
    this.historyFindings.clear();
    this.notifyListeners({ type: 'history-cleared' });
  }

  subscribe(listener: FindingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: FindingsEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in FindingsStore listener:', error);
      }
    });
  }

  getFilesWithFindings(): string[] {
    return Array.from(this.workspaceFindings.keys());
  }

  hasFindings(filePath: string): boolean {
    const findings = this.workspaceFindings.get(filePath);
    return findings ? findings.size > 0 : false;
  }

  clearAll(): void {
    this.clearWorkspaceFindings();
    this.clearHistoryFindings();
  }

  /**
   * Get workspace findings grouped by filePath.
   */
  getGroupedWorkspaceFindings(): { [filePath: string]: WorkspaceFinding[] } {
    const grouped: { [filePath: string]: WorkspaceFinding[] } = {};
    this.workspaceFindings.forEach((findings, filePath) => {
      if (findings.size > 0) {
        grouped[filePath] = Array.from(findings);
      }
    });
    return grouped;
  }
}