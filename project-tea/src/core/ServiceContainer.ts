import * as vscode from 'vscode';
import { FindingsStore } from '../stores/FindingsStore';
import { GitleaksOutputParser } from '../parsers/GitleaksOutputParser';
import { Logger } from '../services/Logger';
import { GitleaksExecutor } from '../services/GitleaksExecutor';
import { ScanService } from '../services/ScanService';
import { NavigationService } from '../services/NavigationService';
import { DiagnosticsUI } from '../ui/DiagnosticsUI';
import { StatusBarUI } from '../ui/StatusBarUI';
import { SidebarProvider } from '../ui/SidebarProvider';
import { MalwareSidebarProvider } from '../ui/MalwareSidebarProvider';
import { ErrorHandler } from '../services/ErrorHandler';
import { ILogger, LogLevel } from '../services/interfaces';
import { ExportService } from '../services/ExportService';
import { ServiceRegistry } from './ServiceRegistry';
import { MalwareScannerService } from '../services/MalwareScannerService';
import { MalwareStore } from '../stores/MalwareStore';
import { MaskingService } from '../services/MaskingService';
import { ScanScheduler } from '../services/ScanScheduler';
/**
 * Service container for dependency injection
 * Manages service lifecycle and provides centralized access to services
 *
 * IMPORTANT: Call initialize() before using any services
 * This is async-safe and ensures proper initialization order
 */
export class ServiceContainer {
  private registry: ServiceRegistry;
  private logger!: ILogger;
  private isInitialized = false;

  constructor(private context: vscode.ExtensionContext) {
    this.registry = new ServiceRegistry();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug('ServiceContainer already initialized, skipping');
      return;
    }

    try {
      // 1. Logger
      this.logger = new Logger(this.context, LogLevel.Info);
      this.registry.register('logger', this.logger);
      this.logSeparator();
      this.logger.info('Secret Tea Extension Initializing');
      this.logSeparator();

      // 2. Create stores (no dependencies)
      this.logger.debug('Initializing FindingsStore...');
      const findingsStore = new FindingsStore();
      this.registry.register('findingsStore', findingsStore);

      // 3. Create core services
      this.logger.debug('Initializing GitleaksExecutor...');
      const executor = new GitleaksExecutor(this.logger);
      this.registry.register('executor', executor);

      this.logger.debug('Initializing GitleaksOutputParser...');
      const parser = new GitleaksOutputParser();
      this.registry.register('parser', parser);

      // 4. Create UI services
      this.logger.debug('Initializing DiagnosticsUI...');
      const diagnosticsUI = new DiagnosticsUI(this.context);
      this.registry.register('diagnosticsUI', diagnosticsUI);

      // 9. Create masking service (before StatusBarUI)
      this.logger.debug('Initializing MaskingService...');
      const maskingService = new MaskingService(this.logger, findingsStore);
      this.registry.register('maskingService', maskingService);

      this.logger.debug('Initializing StatusBarUI...');
      const statusBarUI = new StatusBarUI(this.context, findingsStore, maskingService);
      this.registry.register('statusBarUI', statusBarUI);

      // 5. Create utility services
      this.logger.debug('Initializing NavigationService...');
      const navigationService = new NavigationService(this.logger);
      this.registry.register('navigationService', navigationService);

      // 6. Create error handler
      this.logger.debug('Initializing ErrorHandler...');
      const errorHandler = new ErrorHandler(this.logger, statusBarUI);
      this.registry.register('errorHandler', errorHandler);

      // 7. Create export service
      this.logger.debug('Initializing ExportService...');
      const exportService = new ExportService();
      this.registry.register('exportService', exportService);

       // 8. Create sidebar providers
       this.logger.debug('Initializing SidebarProvider...');
       const sidebarProvider = new SidebarProvider(
         this.context.extensionUri,
         findingsStore,
         navigationService,
         errorHandler,
         this.logger,
         exportService
       );
       this.registry.register('sidebarProvider', sidebarProvider);

       // 9. Create malware store (before MalwareSidebarProvider)
       this.logger.debug('Initializing MalwareStore...');
       const malwareStore = new MalwareStore();
       this.registry.register('malwareStore', malwareStore);

       this.logger.debug('Initializing MalwareSidebarProvider...');
       const malwareSidebarProvider = new MalwareSidebarProvider(
         this.context.extensionUri,
         this.logger,
         malwareStore,
         exportService
       );
       this.registry.register('malwareSidebarProvider', malwareSidebarProvider);

       // 10. Create malware scanner service
       this.logger.debug('Initializing MalwareScannerService...');
       const malwareScannerService = new MalwareScannerService(this.logger);
       this.registry.register('malwareScannerService', malwareScannerService);

       // 11. Create scan service (depends on multiple services)
       this.logger.debug('Initializing ScanService...');
       const scanService = new ScanService(
         executor,
         parser,
         findingsStore,
         diagnosticsUI,
         this.logger,
         maskingService
       );
       this.registry.register('scanService', scanService);

       // 12. Create scan scheduler
       this.logger.debug('Initializing ScanScheduler...');
       const scanScheduler = new ScanScheduler(scanService, this.logger);
       this.registry.register('scanScheduler', scanScheduler);

      this.logSeparator();
      this.logger.info('All services initialized successfully');
      this.logSeparator();
      this.isInitialized = true;

    } catch (error) {
      this.logger?.error('Failed to initialize services', error as Error);
      throw error;
    }
  }

  get<T>(serviceName: string): T {
    if (!this.isInitialized) {
      throw new Error(
        `ServiceContainer not initialized. Call await container.initialize() first`
      );
    }
    try {
      return this.registry.get(serviceName as any) as T;
    } catch (error) {
      throw new Error(
        `Failed to retrieve service '${serviceName}': ${(error as Error).message}`
      );
    }
  }

  has(serviceName: string): boolean {
    return this.registry.has(serviceName);
  }

  dispose(): void {
    this.logSeparator()
    this.logger?.info('Disposing services...');
    this.logSeparator()

    try {
      this.registry.disposeAll();
      this.logger?.info('All services disposed successfully');
      this.isInitialized = false;
    } catch (error) {
      this.logger?.error('Error during service disposal', error as Error);
    }
  }

  private logSeparator(): void {
    this.logger.info('='.repeat(50));
  }
}
