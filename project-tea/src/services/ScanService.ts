import { FindingsStore } from '../stores/FindingsStore';
import { IGitleaksExecutor, ILogger, IOutputParser, IDiagnosticsUI, WorkspaceFinding, HistoryFinding } from './interfaces';

/**
 * Service for orchestrating secret scans
 * Coordinates between executor, parser, store, and UI
 */
export class ScanService {
  public isInitialScanning: boolean = false;

  constructor(
    private executor: IGitleaksExecutor,
    private parser: IOutputParser,
    private findingsStore: FindingsStore,
    private diagnosticsUI: IDiagnosticsUI,
    private logger: ILogger
  ) {
    this.logger.info('ScanService initialized');
  }

  async scanFile(filePath: string): Promise<WorkspaceFinding[]> {
    this.logger.info(`Scanning file: ${filePath}`);
    const startTime = Date.now();

    try {
      // Execute scan
      const output = await this.executor.executeSingleFile(filePath);

      // Parse results
      const findings = this.parser.parseWorkspaceScan(output);

      const duration = Date.now() - startTime;
      this.logger.info(`File scan completed in ${duration}ms. Found ${findings.length} secrets`);

      // Clear old findings for this file
      this.findingsStore.clearWorkspaceFindings(filePath);
      this.diagnosticsUI.clearDiagnostics(filePath);

      // Update store and UI
      if (findings.length > 0) {
        this.findingsStore.addWorkspaceFindings(filePath, findings);
        this.diagnosticsUI.updateDiagnostics(filePath, findings);
        this.diagnosticsUI.highlightFindings(filePath, findings);
      }

      return findings;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`File scan failed after ${duration}ms`, error as Error);
      throw error;
    }
  }

  async scanWorkspace(workspacePath: string): Promise<WorkspaceFinding[]> {
    const startTime = Date.now();

    try {
      const output = await this.executor.executeWorkspace(workspacePath);

      const findings = this.parser.parseWorkspaceScan(output).map(f => ({
        ...f,
        file: f.file.startsWith(workspacePath)
          ? f.file.slice(workspacePath.length).replace(/^\//, '')
          : f.file
      }));

      const duration = Date.now() - startTime;
      this.logger.info(`Workspace scan completed in ${duration}ms. Found ${findings.length} secrets`);

      // Group findings by file
      const findingsByFile = this.groupFindingsByFile(findings);

      // Clear all existing findings
      this.findingsStore.clearWorkspaceFindings();
      this.diagnosticsUI.clearDiagnostics();

      // Update store and UI for each file
      for (const [filePath, fileFindings] of findingsByFile.entries()) {
        this.findingsStore.addWorkspaceFindings(filePath, fileFindings);
        this.diagnosticsUI.updateDiagnostics(filePath, fileFindings);
        this.diagnosticsUI.highlightFindings(filePath, fileFindings);
      }

      return findings;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Workspace scan failed after ${duration}ms`, error as Error);
      throw error;
    }
  }

  async scanHistory(workspacePath: string): Promise<HistoryFinding[]> {
    this.logger.info(`Scanning git history: ${workspacePath}`);
    const startTime = Date.now();

    try {
      const output = await this.executor.executeHistory(workspacePath);

      const findings = this.parser.parseHistoryScan(output).map(f => ({
        ...f,
        file: f.file.startsWith(workspacePath)
          ? f.file.slice(workspacePath.length).replace(/^\//, '')
          : f.file
      }));

      const duration = Date.now() - startTime;
      this.logger.info(`History scan completed in ${duration}ms. Found ${findings.length} secrets`);

      // Clear old history findings
      this.findingsStore.clearHistoryFindings();

      // Update store
      if (findings.length > 0) {
        this.findingsStore.addHistoryFindings(findings);
      }

      return findings;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`History scan failed after ${duration}ms`, error as Error);
      throw error;
    }
  }

  /**
   * Group findings by file path
   */
  private groupFindingsByFile(findings: WorkspaceFinding[]): Map<string, WorkspaceFinding[]> {
    const grouped = new Map<string, WorkspaceFinding[]>();

    for (const finding of findings) {
      if (!grouped.has(finding.file)) {
        grouped.set(finding.file, []);
      }
      grouped.get(finding.file)!.push(finding);
    }

    return grouped;
  }

  getFindingsCount(): { workspace: number; history: number } {
    return {
      workspace: this.findingsStore.getWorkspaceFindingsCount(),
      history: this.findingsStore.getHistoryFindingsCount()
    };
  }

  clearAllFindings(): void {
    this.logger.info('Clearing all findings');
    this.findingsStore.clearAll();
    this.diagnosticsUI.clearDiagnostics();
  }
}