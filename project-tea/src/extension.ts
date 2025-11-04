import * as vscode from 'vscode';
import { RegisterCommand } from './commands';
import { InitializesStatusBar } from './statusBar';

export async function activate(context: vscode.ExtensionContext) {
	console.log('****************************');
	console.log('*    Tea is now active!    *');
	console.log('****************************');
	
	InitializesStatusBar(context);
	RegisterCommand(context);
}

export function deactivate() {}
