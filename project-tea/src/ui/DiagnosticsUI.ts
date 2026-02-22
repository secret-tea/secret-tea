import * as vscode from 'vscode';
import { IDiagnosticsUI, WorkspaceFinding } from '../services/interfaces';

/**
 * Service for managing VS Code diagnostics and editor decorations
 */
export class DiagnosticsUI implements IDiagnosticsUI {
  private collection: vscode.DiagnosticCollection;
  private decorationType: vscode.TextEditorDecorationType;
  private decorationsByFile = new Map<string, vscode.TextEditorDecorationType>();

  constructor(context: vscode.ExtensionContext) {
    this.collection = vscode.languages.createDiagnosticCollection('secret-tea');
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
      border: '1px solid red',
      overviewRulerColor: 'red',
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    context.subscriptions.push(this.collection);
    context.subscriptions.push(this.decorationType);
  }

  updateDiagnostics(filePath: string, findings: WorkspaceFinding[]): void {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = findings.map(f => this.createDiagnostic(f));
    this.collection.set(uri, diagnostics);
  }

  clearDiagnostics(filePath?: string): void {
    if (filePath) {
      const uri = vscode.Uri.file(filePath);
      this.collection.delete(uri);

      // Also clear decorations for this file
      const decoration = this.decorationsByFile.get(filePath);
      if (decoration) {
        decoration.dispose();
        this.decorationsByFile.delete(filePath);
      }
    } else {
      this.collection.clear();

      // Clear all decorations
      this.decorationsByFile.forEach(decoration => decoration.dispose());
      this.decorationsByFile.clear();
    }
  }

  highlightFindings(filePath: string, findings: WorkspaceFinding[]): void {
    // Find the editor for this file
    const editor = this.findEditor(filePath);
    if (!editor) {
      return;
    }

    // Clear old decoration for this file
    const oldDecoration = this.decorationsByFile.get(filePath);
    if (oldDecoration) {
      oldDecoration.dispose();
    }

    // Create new decoration
    const decoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
      border: '1px solid red',
      overviewRulerColor: 'red',
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    this.decorationsByFile.set(filePath, decoration);

    // Create decoration options for all findings
    const decorations = findings.map(f => ({
      range: new vscode.Range(
        new vscode.Position(f.line, 0),
        new vscode.Position(f.line, Number.MAX_SAFE_INTEGER)
      ),
      hoverMessage: `**Secret Detected**: ${f.ruleID}\n\n\`\`\`\n${f.secret}\n\`\`\``
    }));

    // Apply decorations
    editor.setDecorations(decoration, decorations);
  }

  private createDiagnostic(finding: WorkspaceFinding): vscode.Diagnostic {
    const range = new vscode.Range(
      new vscode.Position(finding.line, 0),
      new vscode.Position(finding.line, Number.MAX_SAFE_INTEGER)
    );

    const diagnostic = new vscode.Diagnostic(
      range,
      `Potential ${finding.ruleID} secret detected: ${finding.secret}`,
      vscode.DiagnosticSeverity.Error
    );

    diagnostic.source = 'Secret Tea';
    diagnostic.code = finding.ruleID;

    return diagnostic;
  }

  private findEditor(filePath: string): vscode.TextEditor | undefined {
    const uri = vscode.Uri.file(filePath).toString();
    return vscode.window.visibleTextEditors.find(
      editor => editor.document.uri.toString() === uri
    );
  }

  dispose(): void {
    this.collection.dispose();
    this.decorationType.dispose();
    this.decorationsByFile.forEach(decoration => decoration.dispose());
    this.decorationsByFile.clear();
  }
}