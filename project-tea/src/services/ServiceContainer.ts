import * as vscode from 'vscode';
import { FindingsStore } from '../stores/FindingsStore';
import { GitleaksOutputParser } from '../parsers/GitleaksOutputParser';
import { Logger } from './Logger';
import { GitleaksExecutor } from './GitleaksExecutor';
import { ScanService } from './ScanService';
import { DiagnosticsUI } from '../ui/DiagnosticsUI';
import { StatusBarUI } from '../ui/StatusBarUI';
import { ErrorHandler } from './ErrorHandler';
import { ILogger, LogLevel } from './interfaces';

/**
 * Service container for dependency injection
 * Manages service lifecycle and provides centralized access to services
 */
export class ServiceContainer {
  private services = new Map<string, any>();
  private logger!: ILogger;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Initialize all services
   * Services are created in dependency order
   */
  async initialize(): Promise<void> {
    try {
      // 1. Create logger first (no dependencies)
      this.logger = new Logger(this.context, LogLevel.Info);
      this.register('logger', this.logger);
      this.logger.info('='.repeat(50));
      this.logger.info('Secret Tea Extension Initializing');
      this.logger.info('='.repeat(50));

      // 2. Create stores (no dependencies)
      this.logger.info('Creating FindingsStore...');
      const findingsStore = new FindingsStore();
      this.register('findingsStore', findingsStore);

      // 3. Create executor (depends on logger)
      this.logger.info('Creating GitleaksExecutor...');
      const executor = new GitleaksExecutor(this.logger);
      this.register('executor', executor);

      // 4. Create parser (no dependencies)
      this.logger.info('Creating GitleaksOutputParser...');
      const parser = new GitleaksOutputParser();
      this.register('parser', parser);

      // 5. Create UI services (depend on context and stores)
      this.logger.info('Creating DiagnosticsUI...');
      const diagnosticsUI = new DiagnosticsUI(this.context);
      this.register('diagnosticsUI', diagnosticsUI);

      this.logger.info('Creating StatusBarUI...');
      const statusBarUI = new StatusBarUI(this.context, findingsStore);
      this.register('statusBarUI', statusBarUI);

      // 6. Create error handler (depends on logger and statusBarUI)
      this.logger.info('Creating ErrorHandler...');
      const errorHandler = new ErrorHandler(this.logger, statusBarUI);
      this.register('errorHandler', errorHandler);

      // 7. Create scan service (depends on executor, parser, store, UI, logger)
      this.logger.info('Creating ScanService...');
      const scanService = new ScanService(
        executor,
        parser,
        findingsStore,
        diagnosticsUI,
        this.logger
      );
      this.register('scanService', scanService);

      this.logger.info('='.repeat(50));
      this.logger.info('All services initialized successfully');
      this.logger.info('='.repeat(50));
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to initialize services', error as Error);
      }
      throw error;
    }
  }

  /**
   * Get a service by name
   * @param serviceName Name of the service to retrieve
   * @returns The requested service
   * @throws Error if service not found
   */
  get<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      const error = new Error(`Service '${serviceName}' not found in container`);
      if (this.logger) {
        this.logger.error(error.message);
      }
      throw error;
    }
    return service as T;
  }

  /**
   * Register a service
   * @param name Service name
   * @param service Service instance
   */
  private register(name: string, service: any): void {
    if (this.services.has(name)) {
      const error = new Error(`Service '${name}' is already registered`);
      if (this.logger) {
        this.logger.error(error.message);
      }
      throw error;
    }
    this.services.set(name, service);
  }

  /**
   * Check if a service is registered
   * @param serviceName Name of the service
   * @returns True if service is registered
   */
  has(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * Get all registered service names
   * @returns Array of service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Dispose of all services and clean up resources
   */
  dispose(): void {
    if (this.logger) {
      this.logger.info('='.repeat(50));
      this.logger.info('Disposing services...');
      this.logger.info('='.repeat(50));
    }

    // Dispose services in reverse order of creation
    const serviceNames = this.getServiceNames().reverse();

    for (const name of serviceNames) {
      try {
        const service = this.services.get(name);
        if (service && typeof service.dispose === 'function') {
          if (this.logger && name !== 'logger') {
            this.logger.info(`Disposing ${name}...`);
          }
          service.dispose();
        }
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Error disposing ${name}`, error as Error);
        }
      }
    }

    this.services.clear();

    if (this.logger) {
      this.logger.info('All services disposed');
    }
  }
}