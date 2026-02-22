import * as vscode from 'vscode';
import {
  ScanError,
  ExecutableNotFoundError,
  GitRepositoryError,
  FileTooLargeError,
  ExecutionError,
  ParseError,
  FileSystemError,
  InvalidStateError
} from '../errors/ScanError';
import { ILogger } from './interfaces';
import { IStatusBarUI } from './interfaces';

/**
 * Centralized error handling service for the Secret Tea extension
 * Provides consistent error reporting, logging, and user feedback
 */
export class ErrorHandler {
  constructor(
    private logger: ILogger,
    private statusBar: IStatusBarUI
  ) {}

  handle(error: Error, context: string): void {
    this.logger.error(`Error in ${context}`, error);

    // TODO: Need to improve performance here
    if (error instanceof ExecutableNotFoundError) {
      this.handleCriticalError(error, context);
    } else if (error instanceof InvalidStateError) {
      this.handleCriticalError(error, context);
    } else if (error instanceof GitRepositoryError) {
      this.handleGitRepositoryError(error);
    } else if (error instanceof FileTooLargeError) {
      this.handleFileTooLargeError(error);
    } else if (error instanceof ExecutionError) {
      this.handleExecutionError(error);
    } else if (error instanceof ParseError) {
      this.handleParseError(error);
    } else if (error instanceof FileSystemError) {
      this.handleFileSystemError(error);
    } else if (error instanceof ScanError && error.recoverable) {
      this.handleRecoverableError(error, context);
    } else {
      this.handleUnexpectedError(error, context);
    }
  }

  /**
   * Handle a critical error that prevents the extension from functioning
   */
  private handleCriticalError(error: ScanError, context: string): void {
    const message = error.getUserMessage();

    this.logger.error(`Critical error in ${context}`, error);
    this.statusBar.showError('Extension error');

    vscode.window.showErrorMessage(
      message,
      'View Logs',
      'Report Issue'
    ).then(action => {
      if (action === 'View Logs') {
        this.logger.show();
      } else if (action === 'Report Issue') {
        this.openIssueReporter(error, context);
      }
    });
  }

  /**
   * Handle git repository errors with helpful suggestions
   */
  private handleGitRepositoryError(error: GitRepositoryError): void {
    const message = error.getUserMessage();

    this.logger.warn('Git repository not found', { path: error.path });
    this.statusBar.showError('Not a git repository');

    vscode.window.showWarningMessage(
      message,
      'Initialize Git',
      'Scan Workspace Instead'
    ).then(action => {
      if (action === 'Initialize Git') {
        // Open terminal and suggest git init command
        const terminal = vscode.window.createTerminal('Git Init');
        terminal.show();
        terminal.sendText(`cd "${error.path}" && git init`, false);
      } else if (action === 'Scan Workspace Instead') {
        // Trigger workspace scan command
        vscode.commands.executeCommand('project-tea.scanWorkspace');
      }
    });
  }

  /**
   * Handle file too large errors
   */
  private handleFileTooLargeError(error: FileTooLargeError): void {
    this.logger.warn('File too large to scan', {
      file: error.filePath,
      size: error.size,
      maxSize: error.maxSize
    });

    // Don't show message for every large file, just log it
    // User can check logs if needed
  }

  /**
   * Handle execution errors with diagnostic information
   */
  private handleExecutionError(error: ExecutionError): void {
    const message = error.getUserMessage();

    this.logger.error('Gitleaks execution failed', error);
    this.statusBar.showError('Scan failed');

    vscode.window.showErrorMessage(
      message,
      'View Logs',
      'Retry'
    ).then(action => {
      if (action === 'View Logs') {
        this.logger.show();
      } else if (action === 'Retry') {
        // Retry the last scan
        vscode.commands.executeCommand('project-tea.scanWorkspace');
      }
    });
  }

  /**
   * Handle parse errors
   */
  private handleParseError(error: ParseError): void {
    this.logger.error('Failed to parse Gitleaks output', error);
    this.statusBar.showError('Parse error');

    vscode.window.showErrorMessage(
      error.getUserMessage(),
      'View Logs',
      'Report Issue'
    ).then(action => {
      if (action === 'View Logs') {
        this.logger.show();
        // Also log the problematic output for debugging
        this.logger.debug('Problematic output', { output: error.output });
      } else if (action === 'Report Issue') {
        this.openIssueReporter(error, 'parsing');
      }
    });
  }

  /**
   * Handle file system errors
   */
  private handleFileSystemError(error: FileSystemError): void {
    this.logger.warn('File system error', {
      file: error.filePath,
      message: error.message
    });

    // Only show notification if it's not a common error
    if (!this.isCommonFileSystemError(error)) {
      vscode.window.showWarningMessage(
        error.getUserMessage(),
        'View Logs'
      ).then(action => {
        if (action === 'View Logs') {
          this.logger.show();
        }
      });
    }
  }

  /**
   * Handle recoverable errors
   */
  private handleRecoverableError(error: ScanError, context: string): void {
    const message = error.getUserMessage();

    this.logger.warn(`Recoverable error in ${context}`, error);
    this.statusBar.showError(context);

    vscode.window.showWarningMessage(
      message,
      'View Logs'
    ).then(action => {
      if (action === 'View Logs') {
        this.logger.show();
      }
    });
  }

  /**
   * Handle unexpected errors
   */
  private handleUnexpectedError(error: Error, context: string): void {
    const message = `An unexpected error occurred in ${context}`;

    this.logger.error(message, error);
    this.statusBar.showError('Unexpected error');

    vscode.window.showErrorMessage(
      `${message}\n\nPlease check the logs for more details.`,
      'View Logs',
      'Report Issue',
      'Reload Extension'
    ).then(action => {
      if (action === 'View Logs') {
        this.logger.show();
      } else if (action === 'Report Issue') {
        this.openIssueReporter(error, context);
      } else if (action === 'Reload Extension') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    });
  }

  /**
   * Open GitHub issue reporter with pre-filled error information
   */
  private openIssueReporter(error: Error, context: string): void {
    const errorInfo = error instanceof ScanError
      ? JSON.stringify(error.toJSON(), null, 2)
      : `${error.name}: ${error.message}\n\nStack:\n${error.stack}`;

    const body = encodeURIComponent(
      `## Error Report

**Context:** ${context}

**Error Type:** ${error.name}

**Error Message:**
${error.message}

**Error Details:**
\`\`\`json
${errorInfo}
\`\`\`

**VS Code Version:** ${vscode.version}

**Extension Version:** ${vscode.extensions.getExtension('SecretTea.project-tea')?.packageJSON.version || 'unknown'}

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Additional Context:**
`
    );

    // TODO: update url
    const issueUrl = vscode.Uri.parse(
      `https://github.com/quanghia24/triangle/issues/new?body=${body}&labels=bug&title=${encodeURIComponent(`Error in ${context}`)}`
    );

    vscode.env.openExternal(issueUrl);
  }

  /**
   * Check if a file system error is common and shouldn't trigger a notification
   */
  private isCommonFileSystemError(error: FileSystemError): boolean {
    // Common errors that we don't need to notify about
    const commonErrors = [
      'ENOENT', // File not found
      'EACCES', // Permission denied (might be locked file)
      'EBUSY'   // File is busy
    ];

    if (error.cause) {
      const causeMessage = error.cause.message.toLowerCase();
      return commonErrors.some(code => causeMessage.includes(code.toLowerCase()));
    }

    return false;
  }

  /**
   * Handle errors silently (just log, no user notification)
   * Useful for background operations
   */
  handleSilent(error: Error, context: string): void {
    this.logger.error(`Silent error in ${context}`, error);

    // Update status bar but don't show notification
    if (error instanceof ScanError && !error.recoverable) {
      this.statusBar.showError('Extension error');
    }
  }

  /**
   * Create a user-friendly error message from any error
   */
  getUserMessage(error: Error): string {
    if (error instanceof ScanError) {
      return error.getUserMessage();
    }
    return error.message || 'An unknown error occurred';
  }

  /**
   * Check if an error is recoverable
   */
  isRecoverable(error: Error): boolean {
    if (error instanceof ScanError) {
      return error.isRecoverable();
    }
    return true; // Assume unknown errors are recoverable
  }
}