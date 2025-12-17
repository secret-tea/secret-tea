import * as vscode from 'vscode';
import { FindingsStore } from '../stores/FindingsStore';
import { ILogger, GroupedFindings, WebviewProtocol, ISidebarUI } from '../services/interfaces';
import { NavigationService } from '../services/NavigationService';
import { ErrorHandler } from '../services/ErrorHandler';
import { WebviewCommunicationError } from '../errors/SidebarErrors';

/**
 * Optimized sidebar provider with proper resource management
 * Implements observer pattern for automatic updates from FindingsStore
 * Follows VS Code best practices for webview providers
 */
export class SidebarProvider implements vscode.WebviewViewProvider, ISidebarUI {
  private view?: vscode.WebviewView;
  private disposables: vscode.Disposable[] = [];
  private unsubscribe?: () => void;
  private updateDebounceTimer?: NodeJS.Timeout;
  private readonly DEBOUNCE_MS = 100; // Debounce updates to avoid excessive rendering

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly findingsStore: FindingsStore,
    private readonly navigationService: NavigationService,
    private readonly errorHandler: ErrorHandler,
    private readonly logger: ILogger
  ) {
    // Subscribe to findings changes with debouncing
    this.unsubscribe = this.findingsStore.subscribe(() => {
      this.debouncedRefresh();
    });

    this.logger.debug('SidebarProvider created');
  }

  /**
   * Resolve webview view - called when sidebar is opened
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.extensionUri,
        vscode.Uri.joinPath(this.extensionUri, 'out'),
        vscode.Uri.joinPath(this.extensionUri, 'media')
      ]
    };

    // Set HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(
        (message: WebviewProtocol.ToExtension) => this.handleMessage(message),
        null,
        this.disposables
      )
    );

    // Handle visibility changes to avoid unnecessary updates
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

  /**
   * Handle messages from webview
   */
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

  /**
   * Handle file open request - delegates to NavigationService
   */
  private async handleFileOpen(filePath: string, line: number): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      await this.navigationService.openFileAtLine(filePath, line, workspaceFolder);
    } catch (error) {
      // ErrorHandler will show user-friendly message
      this.errorHandler.handle(error as Error, 'file navigation');
    }
  }

  /**
   * Debounced refresh to avoid excessive updates
   */
  private debouncedRefresh(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
      this.sendDataToWebview();
      this.updateDebounceTimer = undefined;
    }, this.DEBOUNCE_MS);
  }

  /**
   * Public refresh method - forces immediate update
   */
  public refresh(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = undefined;
    }
    this.sendDataToWebview();
  }

  /**
   * Send findings data to webview
   * Optimized to reuse FindingsStore's internal grouping
   */
  private sendDataToWebview(): void {
    if (!this.view || !this.view.visible) {
      this.logger.debug('Skipping data send - view not visible');
      return;
    }

    try {
      // Use optimized grouped findings from store
      const groupedFindings: GroupedFindings = this.findingsStore.getGroupedWorkspaceFindings();
      const findingCount = Object.keys(groupedFindings).length;

      this.logger.debug(`Sending ${findingCount} file(s) with findings to webview`);

      const message: WebviewProtocol.ToWebview = {
        type: 'updateSecrets',
        data: groupedFindings,
        timestamp: Date.now()
      };

      this.view.webview.postMessage(message);
    } catch (error) {
      this.logger.error('Failed to send data to webview', error as Error);
      this.sendErrorToWebview('Failed to load secrets');
    }
  }

  /**
   * Send error message to webview
   */
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

  /**
   * Generate HTML for webview with proper CSP and resource loading
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Generate nonce for CSP
    const nonce = this.getNonce();

    // Get URIs for resources
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reset.css')
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vscode.css')
    );

    // Get codicon font URI - VS Code provides this
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
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
    <button id="scanHistoryBtn" class="scan-history-btn" title="Scan git commit history for secrets">
      <span class="codicon codicon-history"></span>
      <span class="btn-text">Scan Commit History</span>
    </button>
    <div id="secretsList" class="secrets-list">
      <p class="loading">Loading secrets...</p>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate a cryptographically secure nonce for CSP
   */
  private getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  /**
   * Dispose of all resources and clean up
   */
  public dispose(): void {
    this.logger.info('Disposing SidebarProvider');

    // Clear debounce timer
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      this.updateDebounceTimer = undefined;
    }

    // Unsubscribe from store
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    // Dispose all disposables
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }

    this.view = undefined;
  }
}