import * as vscode from 'vscode';
import { FindingsStore } from '../stores/FindingsStore';
import { GitleaksOutputParser } from '../parsers/GitleaksOutputParser';
import { Logger } from './Logger';
import { GitleaksExecutor } from './GitleaksExecutor';
import { ScanService } from './ScanService';
import { NavigationService } from './NavigationService';
import { DiagnosticsUI } from '../ui/DiagnosticsUI';
import { StatusBarUI } from '../ui/StatusBarUI';
import { SidebarProvider } from '../ui/SidebarProvider';
import { ErrorHandler } from './ErrorHandler';
import { ILogger, LogLevel } from './interfaces';

export const ServiceNames = {
  LOGGER: 'logger',
  FINDINGS_STORE: 'findingsStore',
  EXECUTOR: 'executor',
  PARSER: 'parser',
  DIAGNOSTICS_UI: 'diagnosticsUI',
  STATUS_BAR_UI: 'statusBarUI',
  NAVIGATION_SERVICE: 'navigationService',
  ERROR_HANDLER: 'errorHandler',
  SIDEBAR_PROVIDER: 'sidebarProvider',
  SCAN_SERVICE: 'scanService',
} as const;

/**
 * Service container for dependency injection
 * Manages service lifecycle and provides centralized access to services
 */
interface IServiceContainer {
  get<T>(name: string): T;
  register(name: string, service: any): void;
}

export class ServiceContainer implements IServiceContainer {
  private services = new Map<string, any>();
  private logger!: ILogger;
  constructor(private context: vscode.ExtensionContext) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // 1. Create logger
      this.logger = new Logger(this.context, LogLevel.Info);
      this.register(ServiceNames.LOGGER, this.logger);
      this.logger.info('='.repeat(50));
      this.logger.info('Secret Tea Extension Initializing');
      this.logger.info('='.repeat(50));

      // 2. Create stores
      this.logger.info('Creating FindingsStore...');
      const findingsStore = new FindingsStore();
      this.register(ServiceNames.FINDINGS_STORE, findingsStore);

      // 3. Create executor
      this.logger.info('Creating GitleaksExecutor...');
      const executor = new GitleaksExecutor(this.logger);
      this.register(ServiceNames.EXECUTOR, executor);

      // 4. Create parser
      this.logger.info('Creating GitleaksOutputParser...');
      const parser = new GitleaksOutputParser();
      this.register(ServiceNames.PARSER, parser);

      // 5. Create UI services
      this.logger.info('Creating DiagnosticsUI...');
      const diagnosticsUI = new DiagnosticsUI(this.context);
      this.register(ServiceNames.DIAGNOSTICS_UI, diagnosticsUI);

      this.logger.info('Creating StatusBarUI...');
      const statusBarUI = new StatusBarUI(this.context, findingsStore);
      this.register(ServiceNames.STATUS_BAR_UI, statusBarUI);

      // 6. Create navigation service
      this.logger.info('Creating NavigationService...');
      const navigationService = new NavigationService(this.logger);
      this.register(ServiceNames.NAVIGATION_SERVICE, navigationService);

      // 7. Create error handler
      this.logger.info('Creating ErrorHandler...');
      const errorHandler = new ErrorHandler(this.logger, statusBarUI);
      this.register(ServiceNames.ERROR_HANDLER, errorHandler);

      // 8. Create sidebar provider
      this.logger.info('Creating SidebarProvider...');
      const sidebarProvider = new SidebarProvider(
        this.context.extensionUri,
        findingsStore,
        navigationService,
        errorHandler,
        this.logger
      );
      this.register(ServiceNames.SIDEBAR_PROVIDER, sidebarProvider);

      // 9. Create scan service
      this.logger.info('Creating ScanService...');
      const scanService = new ScanService(
        executor,
        parser,
        findingsStore,
        diagnosticsUI,
        this.logger
      );
      this.register(ServiceNames.SCAN_SERVICE, scanService);

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

  // Get a service by name
  get<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      const error = new Error(`Service '${serviceName}' not found`);
      if (this.logger) {
        this.logger.error(error.message);
      }
      throw error;
    }
    return service as T;
  }

  // Register a new service
  register(name: string, service: any): void {
    if (name == "" || !service) {
      const error = new Error(`Cannot register null or undefined service '${name}'`);
      if (this.logger) {
        this.logger.error(error.message);
      }
      throw error;
    }

    this.services.set(name, service);
  }

  dispose(): void {
    if (this.logger) {
      this.logger.info('='.repeat(50));
      this.logger.info('Disposing services...');
      this.logger.info('='.repeat(50));
    }

    // Dispose services in reverse order of creation
    const serviceNames = Array.from(this.services.keys());

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
