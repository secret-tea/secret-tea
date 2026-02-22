import * as vscode from 'vscode';
import * as path from 'path';
import { ILogger } from './interfaces';
import {
  FileNavigationError,
  FileNotFoundError,
  WorkspaceNotFoundError
} from '../errors/SidebarErrors';

// NavigationService handling file navigation and opening.
export class NavigationService {
  constructor(private readonly logger: ILogger) {}

  async openFileAtLine(
    filePath: string,
    line: number,
    workspaceFolder?: vscode.WorkspaceFolder
  ): Promise<void> {
    try {
      const uri = this.resolveFileUri(filePath, workspaceFolder);

      const exists = await this.validateFileExists(uri);
      if (!exists) {
        throw new FileNotFoundError(uri.fsPath);
      }

      await this.openAndNavigate(uri, line);

      this.logger.info(`Opened file ${uri.fsPath} at line ${line}`);
    } catch (error) {
      if (error instanceof FileNavigationError) {
        this.logger.error(error.message, error);
        throw error;
      }

      const navError = new FileNavigationError(
        filePath,
        line,
        error as Error
      );
      this.logger.error(navError.message, navError);
      throw navError;
    }
  }

  /**
   * Resolve file path to VS Code URI
   * Handles absolute paths, relative paths, and file:// URIs
   */
  private resolveFileUri(
    filePath: string,
    workspaceFolder?: vscode.WorkspaceFolder
  ): vscode.Uri {
    // Handle file:// URIs
    if (filePath.startsWith('file:')) {
      return vscode.Uri.parse(filePath);
    }

    // Handle absolute paths
    if (path.isAbsolute(filePath)) {
      return vscode.Uri.file(filePath);
    }

    // Handle relative paths
    if (workspaceFolder) {
      return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    }

    // Fallback: try to resolve against first workspace folder
    const firstWorkspace = vscode.workspace.workspaceFolders?.[0];
    if (firstWorkspace) {
      return vscode.Uri.joinPath(firstWorkspace.uri, filePath);
    }

    // No workspace available
    throw new WorkspaceNotFoundError();
  }

  private async validateFileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private async openAndNavigate(uri: vscode.Uri, line: number): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);

    // Calculate safe line position (0-based)
    const targetLine = Math.max(0, Math.min(line, document.lineCount - 1));

    // Get line text and find first non-whitespace character
    const lineText = document.lineAt(targetLine).text;
    const firstNonWhitespace = lineText.search(/\S/);
    const column = firstNonWhitespace >= 0 ? firstNonWhitespace : 0;

    // Create position and selection
    const startPosition = new vscode.Position(targetLine, column);
    const endPosition = new vscode.Position(targetLine, lineText.length);
    const selection = new vscode.Selection(startPosition, endPosition);

    // Show document with selection
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
      viewColumn: vscode.ViewColumn.One,
      selection: new vscode.Range(startPosition, endPosition)
    });

    // Apply selection and reveal
    editor.selection = selection;
    editor.revealRange(
      new vscode.Range(startPosition, endPosition),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
  }
}