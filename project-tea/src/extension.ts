import * as vscode from 'vscode';
import { ServiceContainer } from './services/ServiceContainer';
import { ScanService } from './services/ScanService';
import { FindingsStore } from './stores/FindingsStore';
import { ILogger, IStatusBarUI } from './services/interfaces';
import { ErrorHandler } from './services/ErrorHandler';
import { UpdateSummary } from './summary';

let container: ServiceContainer;

/**
 * Extension activation
 * Called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
	try {
		// Initialize service container
		container = new ServiceContainer(context);
		await container.initialize();

		const logger = container.get<ILogger>('logger');
		const scanService = container.get<ScanService>('scanService');
		const findingsStore = container.get<FindingsStore>('findingsStore');
		const statusBarUI = container.get<IStatusBarUI>('statusBarUI');
		const errorHandler = container.get<ErrorHandler>('errorHandler');

		logger.info('Registering commands...');

		// Get workspace folder
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceFolder) {
			logger.warn('No workspace folder found');
			vscode.window.showWarningMessage('Secret Tea: No workspace folder found');
			return;
		}

		logger.info(`Workspace folder: ${workspaceFolder}`);

		// Register commands
		const scanCurrentWorkspaceCommand = vscode.commands.registerCommand(
			'project-tea.scanCurrentWorkspace',
			async () => {
				try {
					logger.info('Manual workspace scan initiated');
					vscode.window.showInformationMessage(`Scanning ${workspaceFolder} now`);
					const findings = await scanService.scanWorkspace(workspaceFolder);
					vscode.window.showInformationMessage(
						`Scan complete. Found ${findings.length} secret${findings.length === 1 ? '' : 's'}`
					);
				} catch (error) {
					errorHandler.handle(error as Error, 'workspace scan command');
				}
			}
		);

		const scanRepoHistoryCommand = vscode.commands.registerCommand(
			'project-tea.scanRepoHistory',
			async () => {
				try {
					logger.info('History scan initiated');
					vscode.window.showInformationMessage('Scanning git repo for secrets and preparing report');
					const findings = await scanService.scanHistory(workspaceFolder);
					UpdateSummary(context.subscriptions, findingsStore);
					vscode.window.showInformationMessage(
						`History scan complete. Found ${findings.length} secret${findings.length === 1 ? '' : 's'} in commit history`
					);
				} catch (error) {
					errorHandler.handle(error as Error, 'history scan command');
				}
			}
		);

		const showOutputCommand = vscode.commands.registerCommand(
			'project-tea.showOutput',
			() => {
				logger.show();
			}
		);

		// Register commands with context
		context.subscriptions.push(scanCurrentWorkspaceCommand);
		context.subscriptions.push(scanRepoHistoryCommand);
		context.subscriptions.push(showOutputCommand);

		// Register document save handler
		context.subscriptions.push(
			vscode.workspace.onDidSaveTextDocument(async (document) => {
				await handleDocumentSave(document, scanService, workspaceFolder, logger, errorHandler);
			})
		);

		performInitialScan(workspaceFolder, scanService, logger, errorHandler)

		logger.info('Extension activation complete');
	} catch (error) {
		console.error('Failed to activate Secret Tea extension:', error);
		vscode.window.showErrorMessage(
			`Failed to activate Secret Tea: ${error instanceof Error ? error.message : String(error)}`
		);
		throw error;
	}
}

/**
 * Handle document save event
 * Scans only the saved file for better performance
 */
async function handleDocumentSave(
	document: vscode.TextDocument,
	scanService: ScanService,
	workspaceFolder: string,
	logger: ILogger,
	errorHandler: ErrorHandler
): Promise<void> {
	// Skip certain file schemes
	const excludedSchemes = ['git', 'output', 'debug', 'vscode'];
	if (excludedSchemes.includes(document.uri.scheme)) {
		return;
	}

	// Skip untitled documents
	if (document.isUntitled) {
		return;
	}

	// Get the file path
	const filePath = document.uri.fsPath;

	// Skip files outside workspace
	if (!filePath.startsWith(workspaceFolder)) {
		return;
	}

	try {
		logger.debug(`Document saved: ${filePath}`);
		// Scan only the saved file (much faster than scanning entire workspace)
		await scanService.scanFile(filePath);
	} catch (error) {
		// Handle errors silently for file saves (no popup for every save)
		errorHandler.handleSilent(error as Error, 'file save scan');
	}
}

function performInitialScan(
	workspacePath: string,
	scanService: ScanService,
	logger: ILogger,
	errorHandler: ErrorHandler
): void {
	(async () => {
		try {
			logger.info('Starting background workspace scan');
			const startTime = Date.now();

			// Run scan in background - no UI indication
			const findings = await scanService.scanWorkspace(workspacePath);

			const duration = Date.now() - startTime;
			logger.info(
				`Background scan completed in ${duration}ms. Found ${findings.length} secrets`
			);

		} catch (error) {
			logger.error('Background scan failed', error as Error);
			errorHandler.handleSilent(error as Error, 'background startup scan');
		}
	})();
}

/**
 * Extension deactivation
 * Called when the extension is deactivated
 */
export function deactivate() {
	if (container) {
		container.dispose();
	}
}

