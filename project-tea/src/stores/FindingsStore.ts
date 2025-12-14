import { HistoryFinding, WorkspaceFinding } from '../services/interfaces';

/**
 * Event types emitted by FindingsStore
 */
export type FindingsEvent =
  | { type: 'workspace'; filePath: string; finding: WorkspaceFinding }
  | { type: 'workspace-cleared'; filePath?: string }
  | { type: 'history'; finding: HistoryFinding }
  | { type: 'history-cleared' };

/**
 * Listener function type for FindingsStore events
 */
export interface FindingsListener {
  (event: FindingsEvent): void;
}

/**
 * Centralized store for managing scan findings
 * Replaces global mutable state with proper encapsulation
 * Implements observer pattern for reactive UI updates
 */
export class FindingsStore {
  private workspaceFindings = new Map<string, Set<WorkspaceFinding>>();
  private historyFindings = new Set<HistoryFinding>();
  private listeners = new Set<FindingsListener>();

  /**
   * Add a workspace finding for a specific file
   * @param filePath Absolute path to the file
   * @param finding The finding to add
   */
  addWorkspaceFinding(filePath: string, finding: WorkspaceFinding): void {
    if (!this.workspaceFindings.has(filePath)) {
      this.workspaceFindings.set(filePath, new Set());
    }
    this.workspaceFindings.get(filePath)!.add(finding);
    this.notifyListeners({ type: 'workspace', filePath, finding });
  }

  /**
   * Add multiple workspace findings for a specific file
   * @param filePath Absolute path to the file
   * @param findings Array of findings to add
   */
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

  /**
   * Get all workspace findings for a specific file
   * @param filePath Absolute path to the file
   * @returns Array of findings for the file
   */
  getWorkspaceFindingsForFile(filePath: string): WorkspaceFinding[] {
    const findings = this.workspaceFindings.get(filePath);
    return findings ? Array.from(findings) : [];
  }

  /**
   * Get all workspace findings across all files
   * @returns Array of all workspace findings
   */
  getAllWorkspaceFindings(): WorkspaceFinding[] {
    const allFindings: WorkspaceFinding[] = [];
    this.workspaceFindings.forEach(findings => {
      allFindings.push(...Array.from(findings));
    });
    return allFindings;
  }

  /**
   * Get count of workspace findings
   * @param filePath Optional file path to count findings for specific file
   * @returns Number of findings
   */
  getWorkspaceFindingsCount(filePath?: string): number {
    if (filePath) {
      const findings = this.workspaceFindings.get(filePath);
      return findings ? findings.size : 0;
    }
    return this.getAllWorkspaceFindings().length;
  }

  /**
   * Clear workspace findings for a specific file or all files
   * @param filePath Optional file path. If not provided, clears all findings
   */
  clearWorkspaceFindings(filePath?: string): void {
    if (filePath) {
      this.workspaceFindings.delete(filePath);
      this.notifyListeners({ type: 'workspace-cleared', filePath });
    } else {
      this.workspaceFindings.clear();
      this.notifyListeners({ type: 'workspace-cleared' });
    }
  }

  /**
   * Add a history finding
   * @param finding The historical finding to add
   */
  addHistoryFinding(finding: HistoryFinding): void {
    this.historyFindings.add(finding);
    this.notifyListeners({ type: 'history', finding });
  }

  /**
   * Add multiple history findings
   * @param findings Array of historical findings to add
   */
  addHistoryFindings(findings: HistoryFinding[]): void {
    findings.forEach(finding => {
      this.historyFindings.add(finding);
      this.notifyListeners({ type: 'history', finding });
    });
  }

  /**
   * Get all history findings
   * @returns Array of all historical findings
   */
  getAllHistoryFindings(): HistoryFinding[] {
    return Array.from(this.historyFindings);
  }

  /**
   * Get count of history findings
   * @returns Number of historical findings
   */
  getHistoryFindingsCount(): number {
    return this.historyFindings.size;
  }

  /**
   * Clear all history findings
   */
  clearHistoryFindings(): void {
    this.historyFindings.clear();
    this.notifyListeners({ type: 'history-cleared' });
  }

  /**
   * Subscribe to findings changes
   * @param listener Callback function to be called on changes
   * @returns Unsubscribe function
   */
  subscribe(listener: FindingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a change
   * @param event The event to emit
   */
  private notifyListeners(event: FindingsEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in FindingsStore listener:', error);
      }
    });
  }

  /**
   * Get all files that have findings
   * @returns Array of file paths
   */
  getFilesWithFindings(): string[] {
    return Array.from(this.workspaceFindings.keys());
  }

  /**
   * Check if a file has any findings
   * @param filePath Absolute path to the file
   * @returns True if file has findings
   */
  hasFindings(filePath: string): boolean {
    const findings = this.workspaceFindings.get(filePath);
    return findings ? findings.size > 0 : false;
  }

  /**
   * Clear all findings (workspace and history)
   */
  clearAll(): void {
    this.clearWorkspaceFindings();
    this.clearHistoryFindings();
  }
}