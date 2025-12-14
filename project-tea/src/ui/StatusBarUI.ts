import * as vscode from 'vscode';
import { FindingsStore } from '../stores/FindingsStore';
import { IStatusBarUI } from '../services/interfaces';

/**
 * Service for managing the status bar item
 * Displays count of detected secrets
 */
export class StatusBarUI implements IStatusBarUI {
  private statusBarItem: vscode.StatusBarItem;
  private errorBackground = new vscode.ThemeColor('statusBarItem.errorBackground');
  private warningBackground = new vscode.ThemeColor('statusBarItem.warningBackground');
  private unsubscribe: (() => void) | undefined;

  constructor(
    context: vscode.ExtensionContext,
    private findingsStore: FindingsStore
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.statusBarItem.text = 'Secret Tea';
    this.statusBarItem.command = 'project-tea.showOutput';
    this.statusBarItem.show();

    context.subscriptions.push(this.statusBarItem);

    // Subscribe to findings store changes
    this.unsubscribe = this.findingsStore.subscribe(() => {
      this.update();
    });

    // Initial update
    this.update();
  }

  /**
   * Update status bar with current findings count
   */
  update(): void {
    const count = this.findingsStore.getWorkspaceFindingsCount();

    if (count > 0) {
      this.statusBarItem.backgroundColor = this.warningBackground;
      const icon = '$(warning)';
      this.statusBarItem.text = `${icon} ${count} secret${count === 1 ? '' : 's'} exposed`;
      this.statusBarItem.tooltip = `Secret Tea: ${count} potential secret${count === 1 ? '' : 's'} detected. Click to view details.`;
    } else {
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.text = '$(shield) Secret Tea';
      this.statusBarItem.tooltip = 'Secret Tea: No secrets detected';
    }
  }

  /**
   * Show error message in status bar
   */
  showError(message: string = 'Scan failed'): void {
    this.statusBarItem.text = `$(error) ${message}`;
    this.statusBarItem.backgroundColor = this.errorBackground;
    this.statusBarItem.tooltip = `Secret Tea: ${message}`;
    this.statusBarItem.show();
  }

  /**
   * Show warning in status bar
   */
  showWarning(message: string): void {
    this.statusBarItem.text = `$(warning) ${message}`;
    this.statusBarItem.backgroundColor = this.warningBackground;
    this.statusBarItem.tooltip = `Secret Tea: ${message}`;
    this.statusBarItem.show();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.statusBarItem.dispose();
  }
}