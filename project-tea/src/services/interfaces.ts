import * as vscode from 'vscode';

export interface WorkspaceFinding {
  secret: string;
  ruleID: string;
  file: string;
  line: number;
}

export interface HistoryFinding extends WorkspaceFinding {
  commit: string;
  author: string;
  email: string;
  date: string;
  link: string | null;
}

// Backward compatibility - deprecated type aliases
/** @deprecated Use WorkspaceFinding instead */
export type scanSummaryResultValue = WorkspaceFinding;
/** @deprecated Use HistoryFinding instead */
export type scanHistoryResultValue = HistoryFinding;

/**
 * Interface for executing Gitleaks binary
 */
export interface IGitleaksExecutor {
  /**
   * Execute scan on a single file
   * @param filePath Absolute path to the file
   * @returns Raw stdout from gitleaks command
   */
  executeSingleFile(filePath: string): Promise<string>;

  /**
   * Execute scan on entire workspace
   * @param workspacePath Path to workspace directory
   * @returns Raw stdout from gitleaks command
   */
  executeWorkspace(workspacePath: string): Promise<string>;

  /**
   * Execute scan on git repository history
   * @param workspacePath Path to workspace directory
   * @returns Raw stdout from gitleaks command
   */
  executeHistory(workspacePath: string): Promise<string>;
}

/**
 * Interface for parsing Gitleaks output
 */
export interface IOutputParser {
  /**
   * Parse output from workspace/file scan
   * @param output Raw gitleaks output
   * @returns Array of parsed findings
   */
  parseWorkspaceScan(output: string): WorkspaceFinding[];

  /**
   * Parse output from history scan
   * @param output Raw gitleaks output
   * @returns Array of parsed historical findings
   */
  parseHistoryScan(output: string): HistoryFinding[];
}

/**
 * Interface for managing diagnostics UI
 */
export interface IDiagnosticsUI {
  /**
   * Update diagnostics for a file
   * @param filePath Absolute path to the file
   * @param findings Array of findings for the file
   */
  updateDiagnostics(filePath: string, findings: WorkspaceFinding[]): void;

  /**
   * Clear diagnostics for a file or all files
   * @param filePath Optional file path. If not provided, clears all diagnostics
   */
  clearDiagnostics(filePath?: string): void;

  /**
   * Highlight findings in the editor
   * @param filePath Absolute path to the file
   * @param findings Array of findings to highlight
   */
  highlightFindings(filePath: string, findings: WorkspaceFinding[]): void;

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * Interface for managing status bar UI
 */
export interface IStatusBarUI {
  /**
   * Update status bar with current findings count
   */
  update(): void;

  /**
   * Show error message in status bar
   * @param message Error message to display
   */
  showError(message?: string): void;

  /**
   * Show warning in status bar
   * @param message Warning message to display
   */
  showWarning(message: string): void;

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * Interface for logger service
 */
export interface ILogger {
  /**
   * Log debug message
   * @param message Debug message
   * @param data Optional data to log
   */
  debug(message: string, data?: any): void;

  /**
   * Log info message
   * @param message Info message
   * @param data Optional data to log
   */
  info(message: string, data?: any): void;

  /**
   * Log warning message
   * @param message Warning message
   * @param data Optional data to log
   */
  warn(message: string, data?: any): void;

  /**
   * Log error message
   * @param message Error message
   * @param error Optional error object
   */
  error(message: string, error?: Error): void;

  /**
   * Show output channel
   */
  show(): void;

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * Log levels
 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3
}

/**
 * Scan options
 */
export interface ScanOptions {
  /**
   * Path to scan (file or directory)
   */
  path: string;

  /**
   * Type of scan
   */
  type: 'file' | 'workspace' | 'history';

  /**
   * Whether to use git context
   */
  useGit?: boolean;

  /**
   * Additional flags
   */
  additionalFlags?: string[];
}

/**
 * Scan result
 */
export interface ScanResult {
  /**
   * Array of findings
   */
  findings: WorkspaceFinding[] | HistoryFinding[];

  /**
   * Scan duration in milliseconds
   */
  duration?: number;

  /**
   * Any errors that occurred
   */
  errors?: Error[];
}

/**
 * Sidebar-specific types
 */
export interface GroupedFindings {
  [filePath: string]: WorkspaceFinding[];
}

/**
 * Webview Protocol - Type-safe message passing between extension and webview
 */
export namespace WebviewProtocol {
  /**
   * Messages sent from webview to extension
   */
  export type ToExtension =
    | { type: 'requestSecrets' }
    | { type: 'refresh' }
    | { type: 'scanHistory' }
    | { type: 'openFile'; file: string; line: number }
    | { type: 'ready' };

  /**
   * Messages sent from extension to webview
   */
  export type ToWebview =
    | { type: 'updateSecrets'; data: GroupedFindings; timestamp: number }
    | { type: 'error'; message: string };
}

/**
 * Sidebar UI interface
 */
export interface ISidebarUI extends vscode.WebviewViewProvider {
  /**
   * Refresh the sidebar with latest findings
   */
  refresh(): void;

  /**
   * Dispose of resources
   */
  dispose(): void;
}