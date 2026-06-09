import { ILogger, ISidebarUI } from '../services/interfaces';
import { ScanService } from '../services/ScanService';
import { ErrorHandler } from '../services/ErrorHandler';
import { FindingsStore } from '../stores/FindingsStore';
import { NavigationService } from '../services/NavigationService';
import { DiagnosticsUI } from '../ui/DiagnosticsUI';
import { StatusBarUI } from '../ui/StatusBarUI';
import { GitleaksExecutor } from '../services/GitleaksExecutor';
import { GitleaksOutputParser } from '../parsers/GitleaksOutputParser';
import { MaskingService } from '../services/MaskingService';

import { MalwareScannerService } from '../services/MalwareScannerService';
import { MalwareStore } from '../stores/MalwareStore';
import { ExportService } from '../services/ExportService';
import { ScanScheduler } from '../services/ScanScheduler';

export type ServiceIdentifier =
  | { name: 'logger'; type: ILogger }
  | { name: 'findingsStore'; type: FindingsStore }
  | { name: 'executor'; type: GitleaksExecutor }
  | { name: 'parser'; type: GitleaksOutputParser }
  | { name: 'diagnosticsUI'; type: DiagnosticsUI }
  | { name: 'statusBarUI'; type: StatusBarUI }
  | { name: 'navigationService'; type: NavigationService }
  | { name: 'errorHandler'; type: ErrorHandler }
  | { name: 'sidebarProvider'; type: ISidebarUI }
  | { name: 'malwareSidebarProvider'; type: ISidebarUI }
  | { name: 'scanService'; type: ScanService }
  | { name: 'malwareStore'; type: MalwareStore }
  | { name: 'malwareScannerService'; type: MalwareScannerService }
  | { name: 'exportService'; type: ExportService }
  | { name: 'malwareScannerService'; type: MalwareScannerService }
  | { name: 'maskingService'; type: MaskingService }
  | { name: 'scanScheduler'; type: ScanScheduler };

export type ServiceType<T extends ServiceIdentifier['name']> = Extract<
  ServiceIdentifier,
  { name: T }
>['type'];

export class ServiceRegistry {
  private services = new Map<string, unknown>();

  register<T extends ServiceIdentifier['name']>(
    identifier: T,
    service: ServiceType<T>
  ): void {
    if (!identifier || !service) {
      throw new Error(
        `Cannot register null or undefined service '${identifier}'`
      );
    }

    this.services.set(identifier, service);
  }

  get<T extends ServiceIdentifier['name']>(identifier: T): ServiceType<T> {
    const service = this.services.get(identifier);
    if (!service) {
      throw new Error(`Service '${identifier}' not found in registry`);
    }
    return service as ServiceType<T>;
  }

  has(identifier: string): boolean {
    return this.services.has(identifier);
  }

  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  dispose(identifier: string): void {
    const service = this.services.get(identifier);
    if (service && typeof (service as any).dispose === 'function') {
      (service as any).dispose();
    }
  }

  disposeAll(): void {
    const serviceNames = this.getServiceNames();
    for (const name of serviceNames.reverse()) {
      this.dispose(name);
    }
    this.services.clear();
  }

  clear(): void {
    this.services.clear();
  }
}
