import * as vscode from 'vscode';
import { ServiceContainer } from './services/ServiceContainer';
import { ScanService } from './services/ScanService';
import { ILogger, ISidebarUI } from './services/interfaces';
import { ErrorHandler } from './services/ErrorHandler';
import { CommandManager } from './commands/CommandManager';

let service: ServiceContainer;

/**
 * Extension entry point.
 * This function is called when the extension is activated.
 */
export async function activate(context: vscode.ExtensionContext) {
	try {
		service = new ServiceContainer(context);

		const logger = service.get<ILogger>('logger');
		const scanService = service.get<ScanService>('scanService');
		const sidebarProvider = service.get<ISidebarUI>('sidebarProvider');
		const errorHandler = service.get<ErrorHandler>('errorHandler');

		// Register Sidebar Provider
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(
				'project-tea-sidebar',
				sidebarProvider
			)
		);

		// Determine Workspace Folder
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceFolder) {
			logger.warn('No workspace folder found');
			vscode.window.showWarningMessage('Secret Tea: No workspace folder found');
			return;
		}

		// Register Commands via CommandManager
		const commandManager = new CommandManager(context, service);
		commandManager.registerCommands();

		// Register Event Handlers
		context.subscriptions.push(
			vscode.workspace.onDidSaveTextDocument(async (document) => {
				await handleDocumentSave(document, scanService, workspaceFolder, errorHandler);
			})
		);

		performInitialScan(workspaceFolder, scanService, logger, errorHandler);

		logger.info('Extension activation complete');
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to activate Secret Tea: ${error instanceof Error ? error.message : String(error)}`
		);
		throw error;
	}
}

/**
 * Handles document save event by triggering a scan of the saved file.
 */
async function handleDocumentSave(
	document: vscode.TextDocument,
	scanService: ScanService,
	workspaceFolder: string,
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

	// Skip files outside workspace
	const filePath = document.uri.fsPath;
	if (!filePath.startsWith(workspaceFolder)) {
		return;
	}

	try {
		// Scan only the saved file
		await scanService.scanFile(filePath);
	} catch (error) {
		// Handle errors silently for file saves (no popup for every save)
		errorHandler.handleSilent(error as Error, 'file save scan');
	}
}

/**
 * Performs an initial scan of the workspace on startup.
 */
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

export function deactivate() {
	if (service) {
		service.dispose();
	}
}
