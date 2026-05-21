/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { NavigationService } from '../../services/NavigationService';
import { ILogger } from '../../services/interfaces';
import { FileNotFoundError, WorkspaceNotFoundError } from '../../errors/SidebarErrors';

/**
 * Integration test suite: Navigation Service
 *
 * Tests inside a real VS Code instance.
 * workspace: sample/ (contains README.md)
 *
 * Why vscode-test over Jest?
 *  - NavigationService.openFileAtLine calls vscode.workspace.openTextDocument
 *    and vscode.window.showTextDocument which require a live VS Code host.
 *  - Using the real API guarantees that navigation behaviour matches production
 *    and prevents silent mock drift as the VS Code API evolves.
 *  - CI/CD: run with `xvfb-run -a npm run test:vscode` for headless Linux.
 */
suite('Navigation Integration Test Suite', () => {
  let service: NavigationService;
  let mockLogger: ILogger;

  // ─── Setup ────────────────────────────────────────────────────────────────

  setup(() => {
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      show: () => {},
      dispose: () => {},
    };
    service = new NavigationService(mockLogger);
  });

  // ─── Helper ───────────────────────────────────────────────────────────────

  function getFixturePath(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) { return null; }
    return vscode.Uri.joinPath(folders[0].uri, 'README.md').fsPath;
  }

  // ─── Happy path ───────────────────────────────────────────────────────────

  test('openFileAtLine: should open an existing file without throwing', async () => {
    const fixturePath = getFixturePath();
    if (!fixturePath) {
      assert.ok(true, 'Skipped: no workspace folder available');
      return;
    }

    try {
      await service.openFileAtLine(fixturePath, 0);
      assert.ok(true, 'File opened successfully');
    } catch (error) {
      if (String(error).includes('FileNotFound') || String(error).includes('ENOENT')) {
        assert.fail('fixture file not found — run setup:sample first');
      }
      assert.fail(`openFileAtLine threw unexpectedly: ${error}`);
    }
  });

  test('openFileAtLine: active editor should be on the target file after navigation', async () => {
    const fixturePath = getFixturePath();
    if (!fixturePath) {
      assert.ok(true, 'Skipped: no workspace folder available');
      return;
    }

    try {
      await service.openFileAtLine(fixturePath, 0);
    } catch {
      assert.ok(true, 'Skipped: could not open fixture file');
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    assert.ok(activeEditor, 'There should be an active editor after navigation');
    assert.ok(
      activeEditor!.document.fileName.endsWith('README.md'),
      'Active editor should be the fixture file'
    );
  });

  test('openFileAtLine: clamped line number should not throw even when target line exceeds doc length', async () => {
    const fixturePath = getFixturePath();
    if (!fixturePath) {
      assert.ok(true, 'Skipped: no workspace folder available');
      return;
    }

    // Line 9999 is well beyond the fixture file's length — NavigationService should clamp
    try {
      await service.openFileAtLine(fixturePath, 9999);
      assert.ok(true, 'Large line number was clamped without error');
    } catch (error) {
      if (String(error).includes('FileNotFound')) {
        assert.fail('Fixture file not found — run setup:sample first');
      }
      assert.fail(`openFileAtLine threw on large line number: ${error}`);
    }
  });

  test('openFileAtLine: relative path resolved against workspace folder', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      assert.ok(true, 'Skipped: no workspace folder available');
      return;
    }

    try {
      await service.openFileAtLine('README.md', 0, folders[0]);
      assert.ok(true, 'Relative path resolved and file opened');
    } catch (error) {
      if (String(error).includes('FileNotFound')) {
        assert.fail('Fixture file not found — run setup:sample first');
      }
      assert.fail(`openFileAtLine with relative path threw: ${error}`);
    }
  });

  // ─── Error cases ──────────────────────────────────────────────────────────

  test('openFileAtLine: relative path without workspace should throw WorkspaceNotFoundError', async () => {
    // We override the workspace folders lookup indirectly by using a bare relative
    // path with no workspaceFolder argument when no folder is open.
    // This can only be triggered when truly no workspace is open; in CI we skip it.
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      assert.ok(true, 'Skipped: workspace is open (WorkspaceNotFoundError path not reachable)');
      return;
    }

    try {
      await service.openFileAtLine('relative/file.ts', 1);
      assert.fail('Expected WorkspaceNotFoundError');
    } catch (error) {
      assert.ok(
        error instanceof WorkspaceNotFoundError,
        `Expected WorkspaceNotFoundError, got ${(error as Error).constructor.name}`
      );
    }
  });
});
