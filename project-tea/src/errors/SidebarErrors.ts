/**
 * Custom error hierarchy for sidebar operations
 * Provides better error handling and user feedback
 */

/**
 * Base error class for all sidebar-related errors
 */
export class SidebarError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'SidebarError';

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when webview communication fails
 */
export class WebviewCommunicationError extends SidebarError {
  constructor(
    public readonly operation: string,
    cause?: Error
  ) {
    super(
      `Webview communication failed during ${operation}`,
      cause,
      true // Recoverable
    );
    this.name = 'WebviewCommunicationError';
  }
}

/**
 * Error thrown when file navigation fails
 */
export class FileNavigationError extends SidebarError {
  constructor(
    public readonly filePath: string,
    public readonly line: number,
    cause?: Error
  ) {
    super(
      `Failed to navigate to ${filePath}:${line}`,
      cause,
      true // Recoverable
    );
    this.name = 'FileNavigationError';
  }
}

/**
 * Error thrown when state restoration fails
 */
export class StateRestorationError extends SidebarError {
  constructor(
    public readonly stateKey: string,
    cause?: Error
  ) {
    super(
      `Failed to restore state: ${stateKey}`,
      cause,
      true // Recoverable - can continue with default state
    );
    this.name = 'StateRestorationError';
  }
}

/**
 * Error thrown when file doesn't exist
 */
export class FileNotFoundError extends SidebarError {
  constructor(public readonly filePath: string) {
    super(
      `File not found: ${filePath}`,
      undefined,
      false // Not recoverable
    );
    this.name = 'FileNotFoundError';
  }
}

/**
 * Error thrown when workspace is not available
 */
export class WorkspaceNotFoundError extends SidebarError {
  constructor() {
    super(
      'No workspace folder found. Please open a folder or workspace.',
      undefined,
      false // Not recoverable
    );
    this.name = 'WorkspaceNotFoundError';
  }
}