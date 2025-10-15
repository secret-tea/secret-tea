
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('****************************');
	console.log('*    Tea is now active!    *');
	console.log('****************************');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId paramet	er must match the command field in package.json
	const disposable = vscode.commands.registerCommand('project-tea.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from project-tea!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
