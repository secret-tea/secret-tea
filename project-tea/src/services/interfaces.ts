import * as vscode from 'vscode';

export interface WorkspaceFinding {
  file: string;
  line: number;
  ruleID: string;
  secret: string;
}

export interface HistoryFinding extends WorkspaceFinding {
  commit: string;
  author: string;
  email: string;
  date: string;
  link: string | null;
}

export interface IGitleaksExecutor {
  executeSingleFile(filePath: string): Promise<string>;
  executeWorkspace(workspacePath: string): Promise<string>;
  executeHistory(workspacePath: string): Promise<string>;
}

export interface IOutputParser {
  parseWorkspaceScan(output: string): WorkspaceFinding[];
  parseHistoryScan(output: string): HistoryFinding[];
}

export interface IDiagnosticsUI {
  updateDiagnostics(filePath: string, findings: WorkspaceFinding[]): void;
  clearDiagnostics(filePath?: string): void;
  highlightFindings(filePath: string, findings: WorkspaceFinding[]): void
  dispose(): void;
}

export interface IStatusBarUI {
  update(): void;
  showError(message?: string): void;
  dispose(): void;
}

export interface ILogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error): void;
  show(): void;
  dispose(): void;
}

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3
}

export interface ScanOptions {
  path: string;
  type: 'file' | 'workspace' | 'history';
  useGit?: boolean;
  additionalFlags?: string[];
}

export interface ScanResult {
  findings: WorkspaceFinding[] | HistoryFinding[];

  duration?: number; // in milliseconds
  errors?: Error[];
}

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
    | { type: 'exportSecrets'; format: string }
    | { type: 'ready' };

  /**
   * Messages sent from extension to webview
   */
  export type ToWebview =
    | { type: 'updateSecrets'; data: GroupedFindings; timestamp: number; isScanning?: boolean }
    | { type: 'error'; message: string };
}

export interface ISidebarUI extends vscode.WebviewViewProvider {
  refresh(): void;
  dispose(): void;
}