/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Integration test suite: Secret Scanning
 *
 * Runs inside a real VS Code instance with the extension loaded.
 * workspace: sample/
 */
suite('Scan Secrets Integration Test Suite', () => {
  vscode.window.showInformationMessage('Start Secret Scan integration tests.');

  // ─── Extension lifecycle ──────────────────────────────────────────────────

  test('extension should be present and activate successfully', async () => {
    const ext = vscode.extensions.getExtension('SecretTea.project-tea');
    assert.ok(ext, 'Extension should be present in VS Code');

    if (!ext.isActive) {
      await ext.activate();
    }

    assert.strictEqual(ext.isActive, true, 'Extension should be activated');
  });

  // ─── Workspace scan ───────────────────────────────────────────────────────

  test('scanCurrentWorkspace: command should execute without throwing', async () => {
    try {
      await vscode.commands.executeCommand('project-tea.scanCurrentWorkspace');
      assert.ok(true, 'Command completed without error');
    } catch (error) {
      assert.fail(`scanCurrentWorkspace threw: ${error}`);
    }
  });

  // ─── History scan ─────────────────────────────────────────────────────────

  test('scanRepoHistory: command should execute without throwing on a git repo', async () => {
    // sample/ is initialized as a git repo by scripts/setup-sample-workspace.sh
    try {
      await vscode.commands.executeCommand('project-tea.scanRepoHistory');
      assert.ok(true, 'scanRepoHistory completed without throwing');
    } catch (error) {
      assert.fail(`scanRepoHistory threw: ${error}`);
    }
  });

  // ─── Output log ───────────────────────────────────────────────────────────

  test('showOutput: should open output channel without error', async () => {
    try {
      await vscode.commands.executeCommand('project-tea.showOutput');
      assert.ok(true, 'showOutput completed without error');
    } catch (error) {
      assert.fail(`showOutput threw: ${error}`);
    }
  });

  // ─── Sidebar refresh ──────────────────────────────────────────────────────

  test('sidebar.refresh: should complete without error', async () => {
    try {
      await vscode.commands.executeCommand('project-tea.sidebar.refresh');
      assert.ok(true, 'Sidebar refresh completed without error');
    } catch (error) {
      assert.fail(`sidebar.refresh threw: ${error}`);
    }
  });
});
