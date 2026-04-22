import * as vscode from 'vscode';
import { FindingsStore } from '../stores/FindingsStore';
import { IStatusBarUI } from '../services/interfaces';
import { MaskingService } from '../services/MaskingService';

/**
 * Service for managing the status bar item
 * Displays count of detected secrets and provides masking toggle button
 */
export class StatusBarUI implements IStatusBarUI {
  private statusBarItem: vscode.StatusBarItem;
  private maskingToggleItem: vscode.StatusBarItem;
  private errorBackground = new vscode.ThemeColor('statusBarItem.errorBackground');
  private warningBackground = new vscode.ThemeColor('statusBarItem.warningBackground');
  private unsubscribe: (() => void) | undefined;

  constructor(
    context: vscode.ExtensionContext,
    private findingsStore: FindingsStore,
    private maskingService: MaskingService
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.statusBarItem.text = 'Secret Tea';
    this.statusBarItem.command = 'project-tea.showOutput';
    this.statusBarItem.show();

    // Create masking toggle button on the right side
    this.maskingToggleItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this.maskingToggleItem.command = 'project-tea.toggleMasking';
    this.maskingToggleItem.tooltip = 'Toggle visual masking of API keys';
    this.updateMaskingButton();
    this.maskingToggleItem.show();

    context.subscriptions.push(this.statusBarItem, this.maskingToggleItem);

    // Subscribe to findings store changes
    this.unsubscribe = this.findingsStore.subscribe(() => {
      this.update();
    });

    this.update();
  }

  private updateMaskingButton(): void {
    const isEnabled = this.maskingService.isMaskingEnabled();
    if (isEnabled) {
      this.maskingToggleItem.text = '$(eye-closed)';
    } else {
      this.maskingToggleItem.text = '$(eye)';
    }
  }

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
    
    // Update masking button state
    this.updateMaskingButton();
  }

  showError(message: string = 'Scan failed'): void {
    this.statusBarItem.text = `$(error) ${message}`;
    this.statusBarItem.backgroundColor = this.errorBackground;
    this.statusBarItem.tooltip = `Secret Tea: ${message}`;
    this.statusBarItem.show();
  }

  showWarning(message: string): void {
    this.statusBarItem.text = `$(warning) ${message}`;
    this.statusBarItem.backgroundColor = this.warningBackground;
    this.statusBarItem.tooltip = `Secret Tea: ${message}`;
    this.statusBarItem.show();
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.statusBarItem.dispose();
    this.maskingToggleItem.dispose();
  }
}