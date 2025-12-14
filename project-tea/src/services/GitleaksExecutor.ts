import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { IGitleaksExecutor, ILogger } from './interfaces';
import { ExecutableNotFoundError, ExecutionError, GitRepositoryError } from '../errors/ScanError';

const execAsync = promisify(exec);

/**
 * Service for executing Gitleaks binary
 * Handles platform detection, path resolution, and command execution
 */
export class GitleaksExecutor implements IGitleaksExecutor {
  private executablePath: string;

  constructor(private logger: ILogger) {
    this.executablePath = this.resolveExecutablePath();
    this.logger.info(`Gitleaks executable path: ${this.executablePath}`);
  }

  /**
   * Execute scan on a single file
   */
  async executeSingleFile(filePath: string): Promise<string> {
    this.logger.debug(`Executing single file scan: ${filePath}`);
    const command = this.buildCommand('file', filePath);
    return this.execute(command);
  }

  /**
   * Execute scan on entire workspace
   */
  async executeWorkspace(workspacePath: string): Promise<string> {
    this.logger.debug(`Executing workspace scan: ${workspacePath}`);
    const command = this.buildCommand('workspace', workspacePath);
    return this.execute(command);
  }

  /**
   * Execute scan on git repository history
   */
  async executeHistory(workspacePath: string): Promise<string> {
    this.logger.debug(`Executing history scan: ${workspacePath}`);
    const command = this.buildCommand('history', workspacePath);
    return this.execute(command, { cwd: workspacePath });
  }

  /**
   * Execute gitleaks command
   */
  private async execute(command: string, options: { cwd?: string } = {}): Promise<string> {
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        ...options
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Scan completed in ${duration}ms`);

      if (stderr) {
        this.logger.warn('Gitleaks stderr output', stderr);
      }

      return stdout;
    } catch (error: any) {
      // Gitleaks exits with non-zero code when it finds secrets
      // So we need to check if stdout exists before treating as error
      if (error.stdout) {
        const duration = Date.now() - startTime;
        this.logger.debug(`Scan completed with findings in ${duration}ms`);

        if (error.stderr) {
          this.logger.warn('Gitleaks stderr output', error.stderr);
        }

        return error.stdout;
      }

      // Real error - no stdout
      const duration = Date.now() - startTime;
      this.logger.error(`Scan failed after ${duration}ms`, error);

      // Check if it's a git repository error
      if (error.message && error.message.toLowerCase().includes('not a git repository')) {
        throw new GitRepositoryError(options.cwd || process.cwd());
      }

      // Throw as execution error with details
      throw new ExecutionError(
        error.message || 'Scan execution failed',
        command,
        error.code,
        error
      );
    }
  }

  /**
   * Build gitleaks command based on scan mode
   */
  private buildCommand(mode: 'file' | 'workspace' | 'history', targetPath: string): string {
    const baseFlags = '--log-level error --no-banner --no-color -v';

    switch (mode) {
      case 'file':
        return `"${this.executablePath}" detect ${baseFlags} --no-git --source "${targetPath}"`;

      case 'workspace':
        return `"${this.executablePath}" detect ${baseFlags} --no-git --source "${targetPath}"`;

      case 'history':
        return `"${this.executablePath}" detect ${baseFlags}`;

      default:
        throw new Error(`Unknown scan mode: ${mode}`);
    }
  }

  /**
   * Resolve path to gitleaks executable
   */
  private resolveExecutablePath(): string {
    const executablePrefix = this.getExecutablePrefix();

    // Try executables directory first
    const execInExecutables = path.join(__dirname, '../../executables', executablePrefix);
    if (fs.existsSync(execInExecutables)) {
      return execInExecutables;
    }

    // Try parent directory
    const execInParent = path.join(__dirname, '../../', executablePrefix);
    if (fs.existsSync(execInParent)) {
      return execInParent;
    }

    throw new ExecutableNotFoundError([
      execInExecutables,
      execInParent
    ]);
  }

  /**
   * Get platform-specific executable name
   */
  private getExecutablePrefix(): string {
    let platformName = 'windows';
    let archName = process.arch;

    // Normalize platform
    if (process.platform === 'darwin') {
      platformName = 'darwin';
    } else if (process.platform === 'linux') {
      platformName = 'linux';
    }

    // Normalize architecture
    if (archName === 'x64') {
      archName = 'x64';
    } else if (archName === 'arm64') {
      archName = 'arm64';
    } else if (archName === 'ia32') {
      archName = 'ia32';
    } else if (archName.includes('arm')) {
      archName = 'arm';
    }

    const executableName = `gitleaks_8.30.0_${platformName}_${archName}`;
    const extension = platformName === 'windows' ? '.exe' : '';

    return executableName + extension;
  }

  /**
   * Get the executable path (for testing/debugging)
   */
  getExecutablePath(): string {
    return this.executablePath;
  }
}