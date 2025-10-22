import * as vscode from 'vscode';
import { RegisterCommand } from './commands';
import { InitializesStatusBar } from './statusBar';

export function activate(context: vscode.ExtensionContext) {
	console.log('****************************');
	console.log('*    Tea is now active!    *');
	console.log('****************************');

	context.subscriptions.push(
		vscode.commands.registerCommand('project-tea.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from project-tea!');
		})
	);
	
	InitializesStatusBar(context);
	RegisterCommand(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
