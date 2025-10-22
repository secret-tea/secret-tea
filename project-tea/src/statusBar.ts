import * as vscode from "vscode";
import { FindingsSummary } from "./utils/gitleaks";

let statusBarItem: vscode.StatusBarItem;


let warningBackground = new vscode.ThemeColor('statusBarItem.warningBackground');

// Initializes the status bar for reporting found secrets
export function InitializesStatusBar(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBarItem.text = `Secret scan`;
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

// Update the gitleaks secrets count in status bar
export function UpdateStatusBar() {
	if (!statusBarItem) {
		return;
	}

	const count = (FindingsSummary && typeof (FindingsSummary as any).size === "number") ? (FindingsSummary as any).size : 0;

	if (count > 0) {
		statusBarItem.backgroundColor = warningBackground;
	} else {
		statusBarItem.backgroundColor = undefined;
	}

	statusBarItem.text = `${count} exposing secret${count === 1 ? "" : "s"}`;
	statusBarItem.show();
}

