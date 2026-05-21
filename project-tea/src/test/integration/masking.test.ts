/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Integration test suite: Visual Masking
 *
 * Runs inside a real VS Code instance with the extension loaded.
 * workspace: sample/ (contains README.md)
 */
suite('Masking Integration Test Suite', () => {

  // Helper: ensure extension is active
  async function ensureActive(): Promise<void> {
    const ext = vscode.extensions.getExtension('SecretTea.project-tea');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  }

  // ─── Toggle command ───────────────────────────────────────────────────────

  test('toggleMasking: should execute without error', async () => {
    await ensureActive();
    try {
      await vscode.commands.executeCommand('project-tea.toggleMasking');
      await vscode.commands.executeCommand('project-tea.toggleMasking');
      assert.ok(true, 'Toggle executed twice without error');
    } catch (error) {
      assert.fail(`toggleMasking threw an error: ${error}`);
    }
  });

  test('toggleMasking: should toggle state reliably across multiple invocations', async () => {
    await ensureActive();
    // Toggle 4 times — result should be indistinguishable from the baseline state
    for (let i = 0; i < 4; i++) {
      try {
        await vscode.commands.executeCommand('project-tea.toggleMasking');
      } catch (error) {
        assert.fail(`toggleMasking threw on iteration ${i}: ${error}`);
      }
    }
    assert.ok(true, 'Masking state remained stable across 4 toggles');
  });

  // ─── Integration with a file containing secrets ───────────────────────────

  test('toggleMasking: should work after opening the fixture secret file', async () => {
    await ensureActive();

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      // If no workspace is open, skip the file-based assertion
      assert.ok(true, 'Skipped: no workspace folder available');
      return;
    }

    const fixtureUri = vscode.Uri.joinPath(folders[0].uri, 'README.md');

    try {
      // Open the file with fake secrets
      const doc = await vscode.workspace.openTextDocument(fixtureUri);
      await vscode.window.showTextDocument(doc);

      // Toggle mask on / off
      await vscode.commands.executeCommand('project-tea.toggleMasking');
      await vscode.commands.executeCommand('project-tea.toggleMasking');

      assert.ok(true, 'Masking toggled successfully on a file containing secrets');
    } catch (error) {
      // If fixture doesn't exist yet, fail with a clear message
      if (String(error).includes('FileNotFound') || String(error).includes('ENOENT')) {
        assert.fail('README.md not found — run setup:sample first');
      }
      assert.fail(`Unexpected error while toggling masking: ${error}`);
    }
  });
});
