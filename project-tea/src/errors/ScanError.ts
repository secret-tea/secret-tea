/**
 * Base error class for all Secret Tea scanning errors
 * Provides structured error information including recovery options
 */
export class ScanError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly recoverable: boolean = true,
    public readonly userMessage?: string
  ) {
    super(message);
    this.name = 'ScanError';

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, ScanError.prototype);
  }

  /**
   * Get a user-friendly message suitable for display
   */
  getUserMessage(): string {
    return this.userMessage || this.message;
  }

  /**
   * Check if this error can be recovered from
   */
  isRecoverable(): boolean {
    return this.recoverable;
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when the Gitleaks executable cannot be found
 * This is a critical error that prevents the extension from functioning
 */
export class ExecutableNotFoundError extends ScanError {
  constructor(searchPaths?: string[]) {
    const searchInfo = searchPaths
      ? `\n\nSearched in:\n${searchPaths.map(p => `  - ${p}`).join('\n')}`
      : '';

    super(
      `Gitleaks executable not found${searchInfo}`,
      undefined,
      false, // Not recoverable - extension cannot function
      'The Gitleaks binary could not be found. Please ensure the Secret Tea extension is properly installed. Try reinstalling the extension if this problem persists.'
    );
    this.name = 'ExecutableNotFoundError';
    Object.setPrototypeOf(this, ExecutableNotFoundError.prototype);
  }
}

/**
 * Error thrown when attempting to scan a directory that is not a git repository
 * Only applies to history scans
 */
export class GitRepositoryError extends ScanError {
  constructor(public readonly path: string) {
    super(
      `Not a git repository: ${path}`,
      undefined,
      true, // Recoverable - user can initialize git or scan workspace instead
      `The directory "${path}" is not a git repository. History scanning requires a git repository.\n\nYou can:\n  • Initialize a git repository with "git init"\n  • Scan workspace files instead (which doesn't require git)`
    );
    this.name = 'GitRepositoryError';
    Object.setPrototypeOf(this, GitRepositoryError.prototype);
  }
}

/**
 * Error thrown when a file is too large to scan
 * Prevents performance issues with very large files
 */
export class FileTooLargeError extends ScanError {
  constructor(
    public readonly filePath: string,
    public readonly size: number,
    public readonly maxSize: number
  ) {
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);

    super(
      `File too large: ${filePath} (${sizeMB}MB, max: ${maxSizeMB}MB)`,
      undefined,
      true, // Recoverable - just skip this file
      `The file "${filePath}" is too large to scan (${sizeMB}MB).\n\nThe maximum file size is ${maxSizeMB}MB. You can increase this limit in settings: secretTea.maxFileSize`
    );
    this.name = 'FileTooLargeError';
    Object.setPrototypeOf(this, FileTooLargeError.prototype);
  }
}

/**
 * Error thrown when Gitleaks execution fails
 * Could be due to invalid arguments, system issues, etc.
 */
export class ExecutionError extends ScanError {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number,
    cause?: Error
  ) {
    super(
      `Gitleaks execution failed: ${message}`,
      cause,
      true, // Usually recoverable
      `Failed to execute Gitleaks scan.\n\nCommand: ${command}\nExit code: ${exitCode ?? 'unknown'}\n\nPlease check the Secret Tea output channel for more details.`
    );
    this.name = 'ExecutionError';
    Object.setPrototypeOf(this, ExecutionError.prototype);
  }
}

/**
 * Error thrown when parsing Gitleaks output fails
 * Could indicate a format change or corrupted output
 */
export class ParseError extends ScanError {
  constructor(
    message: string,
    public readonly output: string,
    cause?: Error
  ) {
    super(
      `Failed to parse Gitleaks output: ${message}`,
      cause,
      true, // Recoverable - can try again
      'Failed to parse scan results. This might be due to a Gitleaks version mismatch or corrupted output.\n\nPlease check the Secret Tea output channel for details.'
    );
    this.name = 'ParseError';
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

/**
 * Error thrown when file operations fail
 * Reading, writing, or checking file existence
 */
export class FileSystemError extends ScanError {
  constructor(
    message: string,
    public readonly filePath: string,
    cause?: Error
  ) {
    super(
      `File system error for ${filePath}: ${message}`,
      cause,
      true, // Usually recoverable
      `Unable to access file: ${filePath}\n\n${message}`
    );
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Error thrown when the extension is in an invalid state
 * Should not normally occur in production
 */
export class InvalidStateError extends ScanError {
  constructor(message: string) {
    super(
      `Invalid state: ${message}`,
      undefined,
      false, // Not recoverable - indicates a bug
      'The extension is in an invalid state. Please reload VS Code.\n\nIf this problem persists, please report it as a bug.'
    );
    this.name = 'InvalidStateError';
    Object.setPrototypeOf(this, InvalidStateError.prototype);
  }
}