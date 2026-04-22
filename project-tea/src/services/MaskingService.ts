import * as vscode from 'vscode';
import { WorkspaceFinding } from './interfaces';
import { ILogger } from './interfaces';
import { FindingsStore } from '../stores/FindingsStore';

/**
 * Service for managing visual masking of sensitive data
 * Uses TextEditorDecorationType to visually mask sensitive values without modifying source
 */
export class MaskingService {
  private maskingEnabled = true; // Auto-enabled by default
  private decorationType: vscode.TextEditorDecorationType | null = null;
  private activeEditor: vscode.TextEditor | null = null;
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
    private logger: ILogger,
    private findingsStore: FindingsStore
  ) {
    this.logger.info('MaskingService initialized');
    // Initialize with current active editor
    this.activeEditor = vscode.window.activeTextEditor || null;
    this.logger.debug(`Active editor on init: ${this.activeEditor?.document.uri.fsPath || 'none'}`);
    
    // Create decoration type immediately
    this.decorationType = this.createMaskingDecoration();
    
    this.setupEventListeners();
  }

  /**
   * Initialize masking decoration type with visual styling
   */
  private createMaskingDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: 'gray', 
      color: 'gray', 
    });
  }

  /**
   * Setup event listeners for document and editor changes
   */
  private setupEventListeners(): void {
    // Listen to active editor changes
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        this.activeEditor = editor || null;
        if (this.maskingEnabled && editor) {
          this.updateMasking(editor);
        }
      }
    );
    this.disposables.push(editorChangeDisposable);

    // Subscribe to FindingsStore changes
    const unsubscribe = this.findingsStore.subscribe((event) => {
      if ((event.type === 'workspace' || event.type === 'workspace-cleared') && this.maskingEnabled) {
        this.logger.debug(`FindingsStore event: ${event.type}`);
        if (this.activeEditor) {
          this.updateMaskingDebounced();
        }
      }
    });
    
    this.disposables.push({
      dispose: unsubscribe
    } as vscode.Disposable);

    // Listen to document text changes - real-time masking update
    const docChangeDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (this.maskingEnabled && this.activeEditor && event.document === this.activeEditor.document) {
          // Debounce rapid changes for performance
          this.updateMaskingDebounced();
        }
      }
    );
    this.disposables.push(docChangeDisposable);
  }

  /**
   * Debounce masking updates to optimize performance
   */
  private updateMaskingDebounced(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      if (this.activeEditor) {
        this.updateMasking(this.activeEditor);
      }
    }, 300); // 300ms debounce
  }


  private updateMasking(editor: vscode.TextEditor): void {
    if (!this.maskingEnabled) {
      this.logger.debug('Masking is disabled, skipping');
      return;
    }

    // Ensure we're applying to the correct editor
    if (editor !== this.activeEditor) {
      this.logger.debug('Editor has changed, not updating');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const findings = this.findingsStore.getWorkspaceFindingsForFile(filePath);
    

    if (findings.length === 0) {
      // Clear decorations if no findings
      if (this.decorationType) {
        this.logger.debug('No findings, clearing decorations');
        editor.setDecorations(this.decorationType, []);
      }
      return;
    }

    const decorationOptions: vscode.DecorationOptions[] = [];

    for (const finding of findings) {
      try {
        // Gitleaks line numbers are 1-based, convert to 0-based for VSCode
        const lineNumber = finding.line;
        
        if (lineNumber < 0 || lineNumber >= editor.document.lineCount) {
          this.logger.debug(`Skipping finding: line ${finding.line} out of range (doc has ${editor.document.lineCount} lines)`);
          continue;
        }
        
        const line = editor.document.lineAt(lineNumber);
        const secretLength = finding.secret?.length || 0;
        
        // Find ALL occurrences of the secret in the line (not just the first)
        if (finding.secret) {
          let startChar = line.text.indexOf(finding.secret, 0);
          
          // Find all occurrences
          while (startChar !== -1) {
            // Che đúng số lượng secret, không che 2x
            const endChar = startChar + secretLength;
            
            const range = new vscode.Range(
              lineNumber,
              startChar,
              lineNumber,
              Math.min(endChar, line.text.length) // Don't exceed line length
            );
            
            decorationOptions.push({
              range,
              // No renderOptions - just use the gray styling from decorationType
            });
                        
            // Continue searching after this occurrence
            startChar = line.text.indexOf(finding.secret, endChar);
          }
        }
        
      } catch (error) {
        this.logger.debug(`Error at line ${finding.line}:`, error);
      }
    }

    // Apply decorations to editor
    if (this.decorationType) {
      editor.setDecorations(this.decorationType, decorationOptions);
    }
  }

  /**
   * Check if masking is currently enabled
   */
  isMaskingEnabled(): boolean {
    return this.maskingEnabled;
  }

  /**
   * Toggle masking feature on/off
   */
  toggleMasking(): void {
    this.maskingEnabled = !this.maskingEnabled;
    this.logger.info(`Visual Masking ${this.maskingEnabled ? 'enabled' : 'disabled'}`);

    if (this.maskingEnabled) {
      // Apply masking to current editor
      if (this.activeEditor) {
        this.logger.debug('Enabling masking, updating current editor');
        this.updateMasking(this.activeEditor);
      }

      vscode.window.showInformationMessage('Visual Masking: ON ✓');
    } else {
      // Clear all decorations when disabled
      if (this.decorationType && this.activeEditor) {
        this.activeEditor.setDecorations(this.decorationType, []);
      }
      vscode.window.showInformationMessage('Visual Masking: OFF');
    }
  }

  /**
   * Clear all decorations
   */
  clearAll(): void {
    if (this.decorationType && this.activeEditor) {
      this.activeEditor.setDecorations(this.decorationType, []);
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
    }
    this.disposables.forEach(d => d.dispose());
  }
}