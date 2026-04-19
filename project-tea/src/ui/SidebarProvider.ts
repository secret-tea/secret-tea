import * as vscode from 'vscode';
import { FindingsStore } from '../stores/FindingsStore';
import { ILogger, GroupedFindings, WebviewProtocol, ISidebarUI } from '../services/interfaces';
import { NavigationService } from '../services/NavigationService';
import { ErrorHandler } from '../services/ErrorHandler';
import { WebviewCommunicationError } from '../errors/SidebarErrors';
import { ExportService } from '../services/ExportService';

export class SidebarProvider implements vscode.WebviewViewProvider, ISidebarUI {
  private view?: vscode.WebviewView;
  private disposables: vscode.Disposable[] = [];
  private unsubscribe?: () => void;
  private updateDebounceTimer?: NodeJS.Timeout;
  private readonly DEBOUNCE_MS = 2000; // Debounce updates to avoid excessive rendering

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly findingsStore: FindingsStore,
    private readonly navigationService: NavigationService,
    private readonly errorHandler: ErrorHandler,
    private readonly logger: ILogger,
    private readonly exportService: ExportService
  ) {
    this.unsubscribe = this.findingsStore.subscribe(() => {
      this.debouncedRefresh();
    });

    this.logger.debug('SidebarProvider created');
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.extensionUri,
        vscode.Uri.joinPath(this.extensionUri, 'out'),
        vscode.Uri.joinPath(this.extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(
        (message: WebviewProtocol.ToExtension) => this.handleMessage(message),
        null,
        this.disposables
      )
    );

    this.disposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          this.logger.debug('Sidebar became visible, refreshing');
          this.sendDataToWebview();
        }
      })
    );

    this.logger.info('Sidebar view resolved');
  }

  private async handleMessage(message: WebviewProtocol.ToExtension): Promise<void> {
    try {
      switch (message.type) {
        case 'requestSecrets':
          this.logger.debug('Webview requested secrets');
          this.sendDataToWebview();
          break;

        case 'refresh':
          this.logger.info('Manual refresh requested from sidebar');
          this.refresh();
          break;

        case 'scanHistory':
          this.logger.info('Scan history requested from sidebar');
          await vscode.commands.executeCommand('project-tea.scanRepoHistory');
          break;

        case 'openFile':
          this.logger.debug(`Opening file: ${message.file} at line ${message.line}`);
          await this.handleFileOpen(message.file, message.line);
          break;

        case 'ready':
          this.logger.debug('Webview ready, sending initial data');
          this.sendDataToWebview();
          break;

        case 'exportSecrets':
          this.logger.info(`Export secrets requested in format: ${message.format}`);
          await this.handleExport(message.format);
          break;

        default:
          this.logger.warn('Unknown message type from webview', message);
      }
    } catch (error) {
      const commError = new WebviewCommunicationError(
        'message handling',
        error as Error
      );
      this.errorHandler.handleSilent(commError, 'sidebar message handling');
      this.sendErrorToWebview('Failed to process action');
    }
  }

  private async handleExport(format: string): Promise<void> {
    try {
      const workspaceFindings = this.findingsStore.getAllWorkspaceFindings();
      const historyFindings = this.findingsStore.getAllHistoryFindings();

      if (workspaceFindings.length === 0 && historyFindings.length === 0) {
        vscode.window.showInformationMessage('No findings to export.');
        return;
      }

      let filters: { [name: string]: string[] } = {};
      if (format === 'json') filters = { 'JSON': ['json'] };
      if (format === 'csv-workspace' || format === 'csv-history') filters = { 'CSV': ['csv'] };
      if (format === 'pdf') filters = { 'PDF': ['pdf'] };

      const uri = await this.exportService.promptSaveLocation(`secret-findings.${format.startsWith('csv') ? 'csv' : format}`, filters);
      if (!uri) return;

      if (format === 'json') {
        await this.exportService.exportSecretsToJson(workspaceFindings, historyFindings, uri);
      } else if (format === 'csv-workspace') {
        if (workspaceFindings.length === 0) {
          vscode.window.showInformationMessage('No workspace findings to export.');
          return;
        }
        await this.exportService.exportWorkspaceSecretsToCsv(workspaceFindings, uri);
      } else if (format === 'csv-history') {
        if (historyFindings.length === 0) {
          vscode.window.showInformationMessage('No history findings to export.');
          return;
        }
        await this.exportService.exportHistorySecretsToCsv(historyFindings, uri);
      } else if (format === 'pdf') {
        await this.exportService.exportSecretsToPdf(workspaceFindings, historyFindings, uri);
      }

      vscode.window.showInformationMessage(`Exported successfully to ${uri.fsPath}`);
    } catch (error) {
      this.errorHandler.handle(error as Error, 'export secrets');
    }
  }

  private async handleFileOpen(filePath: string, line: number): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      await this.navigationService.openFileAtLine(filePath, line, workspaceFolder);
    } catch (error) {
      // ErrorHandler will show user-friendly message
      this.errorHandler.handle(error as Error, 'file navigation');
    }
  }

  private debouncedRefresh(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
      this.sendDataToWebview();
      this.updateDebounceTimer = undefined;
    }, this.DEBOUNCE_MS);
  }

  public refresh(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = undefined;
    }
    this.sendDataToWebview();
  }

  private sendDataToWebview(): void {
    if (!this.view || !this.view.visible) {
      this.logger.debug('Skipping data send - view not visible');
      return;
    }

    try {
      const groupedFindings: GroupedFindings = this.findingsStore.getGroupedWorkspaceFindings();
      const findingCount = Object.keys(groupedFindings).length;

      this.logger.debug(`Sending ${findingCount} file(s) with findings to webview`);

      const message: WebviewProtocol.ToWebview = {
        type: 'updateSecrets',
        data: groupedFindings,
        timestamp: Date.now(),
        isScanning: this.findingsStore.isScanning
      };

      this.view.webview.postMessage(message);
    } catch (error) {
      this.logger.error('Failed to send data to webview', error as Error);
      this.sendErrorToWebview('Failed to load secrets');
    }
  }

  private sendErrorToWebview(message: string): void {
    if (!this.view) {
      return;
    }

    const errorMessage: WebviewProtocol.ToWebview = {
      type: 'error',
      message
    };

    this.view.webview.postMessage(errorMessage);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reset.css')
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vscode.css')
    );

    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'codicon.css')
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'sidebar.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${codiconUri}" rel="stylesheet">
  <link href="${styleVSCodeUri}" rel="stylesheet">
  <title>Secret Tea Scanner</title>
</head>
<body>
  <div class="sidebar-container">
    <div class="toolbar split-toolbar">
      <button id="scanHistoryBtn" class="scan-history-btn" title="Scan git commit history for secrets">
        <span class="codicon codicon-history"></span>
        <span class="btn-text">Scan git history</span>
      </button>
      <div class="dropdown-container">
        <button id="exportSecretsToggleBtn" class="dropdown-toggle-btn" title="Export Findings">
          <span class="codicon codicon-chevron-down"></span>
        </button>
        <div id="exportSecretsDropdown" class="dropdown-menu hidden">
          <div class="dropdown-item" data-format="json">Export to JSON</div>
          <div class="dropdown-item" data-format="csv-workspace">Export workspace to CSV</div>
          <div class="dropdown-item" data-format="csv-history">Export history to CSV</div>
          <div class="dropdown-item" data-format="pdf">Export to PDF</div>
        </div>
      </div>
    </div>
    <div id="secretsList" class="secrets-list">
      <p class="loading">Loading secrets...</p>
    </div>
  </div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  public dispose(): void {
    this.logger.info('Disposing SidebarProvider');

    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = undefined;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }

    this.view = undefined;
  }
}