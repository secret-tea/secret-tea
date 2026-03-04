import * as vscode from 'vscode';
import { ServiceContainer } from '../services/ServiceContainer';
import { ScanService } from '../services/ScanService';
import { FindingsStore } from '../stores/FindingsStore';
import { ILogger, ISidebarUI } from '../services/interfaces';
import { ErrorHandler } from '../services/ErrorHandler';
import { SummaryPanel } from '../ui/SummaryPanel';

export class CommandManager {
  constructor(
      private context: vscode.ExtensionContext,
      private service: ServiceContainer
  ) {}

  public registerCommands(): void {
    const logger = this.service.get<ILogger>('logger');
    const scanService = this.service.get<ScanService>('scanService');
    const findingsStore = this.service.get<FindingsStore>('findingsStore');
    const sidebarProvider = this.service.get<ISidebarUI>('sidebarProvider');
    const errorHandler = this.service.get<ErrorHandler>('errorHandler');

    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // 1. Scan Current Workspace
    this.registerCommand('project-tea.scanCurrentWorkspace', async () => {
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('Secret Tea: No workspace folder found');
        return;
      }
      try {
        vscode.window.showInformationMessage(`Scanning ${workspaceFolder} now`);
        const findings = await scanService.scanWorkspace(workspaceFolder);
        vscode.window.showInformationMessage(
          `Scan complete. Found ${findings.length} secret${findings.length === 1 ? '' : 's'}`
        );
      } catch (error) {
        errorHandler.handle(error as Error, 'workspace scan command');
      }
    });

    // 2. Scan Repo History
    this.registerCommand('project-tea.scanRepoHistory', async () => {
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('Secret Tea: No workspace folder found');
        return;
      }
      try {
        vscode.window.showInformationMessage('Scanning git repo for secrets and preparing report');
        const findings = await scanService.scanHistory(workspaceFolder);

        // Show summary panel
        SummaryPanel.update(this.context.subscriptions, findingsStore);

        vscode.window.showInformationMessage(
            `History scan complete. Found ${findings.length} secret${findings.length === 1 ? '' : 's'} in commit history`
        );
      } catch (error) {
        errorHandler.handle(error as Error, 'history scan command');
      }
    });

    // 3. Show Output
    this.registerCommand('project-tea.showOutput', () => {
      logger.show();
    });

    // 4. Refresh Sidebar
    this.registerCommand('project-tea.sidebar.refresh', () => {
      logger.info('Sidebar refresh command triggered');
      sidebarProvider.refresh();
    });
  }

  private registerCommand(id: string, callback: (...args: any[]) => any): void {
    const disposable = vscode.commands.registerCommand(id, callback);
    this.context.subscriptions.push(disposable);
  }
}
