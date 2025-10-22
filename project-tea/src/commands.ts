import * as vscode from "vscode";
import { FindingsSummary, RunScanCurrentDir, RunScanRepoHistory } from "./utils/gitleaks";
import { UpdateStatusBar } from "./statusBar";
import { UpdateSummary } from "./summary";

let workspaceFolder: string;

/* 
	Register commands to the extension
	Available commands
		- project-tea.scanCurrentFile
		- project-tea.scanCurrentWorkspace
		- project-tea.scanRepoHistory
*/
export function RegisterCommand(context: vscode.ExtensionContext) {
	// Gets the workspace folder from the configuration
	workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
	if (!workspaceFolder) {
		vscode.window.showErrorMessage("No folder is open in the workspace.");
		return;
	}

	const scanCurrentWorkspaceCommand = vscode.commands.registerCommand('project-tea.scanCurrentWorkspace', async () => {
		vscode.window.showInformationMessage(`Scanning ${workspaceFolder} now`);
		await RunScanCurrentDir(workspaceFolder, true);
	});

	const scanRepoHistoryCommand = (vscode.commands.registerCommand('project-tea.scanRepoHistory', async () => {
		try {
			vscode.window.showInformationMessage(`Scanning the git repo for secrets and preparing report`);
			await RunScanRepoHistory(workspaceFolder);
			UpdateSummary(context.subscriptions);
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error generating secrets summary: ${error.message}`);
		}
	}));

	// Command Palettes
	context.subscriptions.push(scanCurrentWorkspaceCommand);;
	context.subscriptions.push(scanRepoHistoryCommand);

	// Run on save
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async () => handleDocumentSave(workspaceFolder)));
}

// Run the scan, update the status bar when any document is saved in the workspace
async function handleDocumentSave(source: string) {
    await RunScanCurrentDir(source, true);
    UpdateStatusBar();
}