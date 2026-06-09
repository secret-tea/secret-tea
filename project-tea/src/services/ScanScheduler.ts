import * as os from 'os';
import { ScanService } from './ScanService';
import { ILogger } from './interfaces';

export class ScanScheduler {
  private pendingFiles: Set<string> = new Set();
  private debounceTimeout: NodeJS.Timeout | null = null;

  // Configuration
  private readonly MAX_CONCURRENT_SCANS = 3;
  private readonly WORKSPACE_SCAN_THRESHOLD = 10;
  private readonly DEBOUNCE_DELAY_MS = 500;

  constructor(
    private scanService: ScanService,
    private logger: ILogger
  ) {}

  public enqueueFile(filePath: string, workspacePath: string): void {
    this.pendingFiles.add(filePath);

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.processBatch(workspacePath).catch(error => {
        this.logger.error(`Error processing batch scan: ${error instanceof Error ? error.message : String(error)}`, error as Error);
      });
    }, this.DEBOUNCE_DELAY_MS);
  }

  private async processBatch(workspacePath: string): Promise<void> {
    if (this.pendingFiles.size === 0) {
      return;
    }

    // Check if we should fallback to full workspace scan
    if (this.pendingFiles.size > this.WORKSPACE_SCAN_THRESHOLD) {
      this.logger.info(`Many files saved (${this.pendingFiles.size}). Switching to full workspace scan for optimization.`);
      this.pendingFiles.clear();

      try {
        await this.scanService.scanWorkspace(workspacePath);
      } catch (error) {
        this.logger.error('Failed to run full workspace scan from scheduler', error as Error);
      }
      return;
    }

    // Proceed with concurrent individual file scans
    const filesToScan = Array.from(this.pendingFiles);
    this.pendingFiles.clear();

    this.logger.info(`Processing batch of ${filesToScan.length} files with concurrency ${this.MAX_CONCURRENT_SCANS}`);

    const workers = Array.from({ length: this.MAX_CONCURRENT_SCANS }, async () => {
      while (filesToScan.length > 0) {
        const file = filesToScan.shift();
        if (file) {
          try {
            await this.scanService.scanFile(file);
          } catch (error) {
            this.logger.error(`Failed to scan file ${file} in batch`, error as Error);
          }
        }
      }
    });

    await Promise.all(workers);
  }
}
