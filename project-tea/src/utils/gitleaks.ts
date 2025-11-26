import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { DiagnosticCollection, DiagnosticsMap } from '../diagnostics';
import { scanHistoryResultValue, scanSummaryResultValue } from '../interface';
import { ShowStatusBarError } from '../statusBar';

export let FindingsSummary: Set<scanSummaryResultValue> = new Set();
export let FindingsHistory: Set<scanHistoryResultValue> = new Set();

function getExecutablePath(executablePrefix: string) {
	const execInExecutables = path.join(`${__dirname}/../../executables`, executablePrefix);
	const execInParent = path.join(`${__dirname}/../../`, executablePrefix);

	if (fs.existsSync(execInExecutables)) {
		return execInExecutables;
	} else if (fs.existsSync(execInParent)) {
		return execInParent;
	}

	throw new Error(`Executable ${executablePrefix} not found in either location`);
}

function getExecutablePrefix() {
    let platform = process.platform;
		let myplatform = 'windows';
    let arch = process.arch;

    // Normalize platform and architecture names to match the naming convention of the executables
    if (platform === 'darwin') {
			myplatform = 'darwin';
    } else if (platform === 'linux') {
			myplatform = 'linux';
    }

    // Normalize architecture, if necessary
    if (arch === 'ia32') {
			arch = 'ia32'; // idk
    } else if (arch === 'x64') {
			arch = 'x64';
    } else if (arch.includes('arm')) {
			if (arch === 'arm64') {
				arch = 'arm64';
			} else {
				arch = `arm`; // idk
			}
    }

    // Construct the executable filename
    const executableName = `gitleaks_8.28.0_${myplatform}_${arch}`;
    const executableExtension = myplatform === 'windows' ? '.exe' : '';

    return executableName + executableExtension;
}

export function RunScanCurrentDir(workspacePath: string, isWorkspaceScan = false) {
	return new Promise((resolve, reject) => {
		if (!workspacePath) {
			console.error('No workspace path provided for Gitleaks scan.');
			return;
		}

		const executablePrefix = getExecutablePrefix();
		const executablePath = getExecutablePath(executablePrefix);
		const command = `${executablePath} detect --log-level error --source ${workspacePath} --no-color --no-banner -v --no-git`;

		exec(command, (err, stdout, stderr) => {
			// Note: gitleaks exits with a non-zero code when it finds secrets.
			// That causes `err` to be set even though stdout contains the findings.
			// Treat non-zero exits as non-fatal when stdout is present and parse the output.
			if (stderr) {
				const errorMessage = `Gitleaks scan stderr: ${stderr}`;
				console.warn(errorMessage);
			}

			if (stdout) {
				// Parse the output even if `err` exists (findings cause non-zero exit code).
				try {
					parseAndHighlightFindings(stdout, isWorkspaceScan);
					resolve(stdout);
				} catch (parseError) {
					console.error("Error parsing gitleaks output:", parseError);
					vscode.window.showErrorMessage(`Error parsing gitleaks output: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
					reject(parseError);
				}
				return;
			}

			// If there's no stdout, treat this as a real error (or no findings).
			if (err) {
				const errorMessage = `Gitleaks scan failed: ${err.message}`;
				vscode.window.showErrorMessage(errorMessage);
				ShowStatusBarError();
				console.error(errorMessage, err);
				reject(err);
				return;
			}

			// No stdout and no err -> no findings
			FindingsSummary = new Set();
			if (isWorkspaceScan) {
				DiagnosticCollection.clear();
			}
			resolve(stdout);
		});
	});
}

export function RunScanRepoHistory(workspacePath?: string) {
	return new Promise((resolve, reject) => {
		const executablePrefix = getExecutablePrefix();
		const executablePath = getExecutablePath(executablePrefix);
		const command = `${executablePath} detect --log-level error --no-banner --no-color -v`;

		const execOptions = workspacePath ? { cwd: workspacePath } : {};

		exec(command, execOptions, (err, stdout, stderr) => {
			// As above: gitleaks can return a non-zero exit code when it finds secrets.
			if (stderr) {
				const errorMessage = `Gitleaks repo history scan stderr: ${stderr}`;
				console.warn(errorMessage);
			}

			if (stdout) {
				try {
					parseFindingForRepoHistory(stdout);
					resolve(stdout);
				} catch (parseError) {
					console.error("Error parsing gitleaks repo history output:", parseError);
					vscode.window.showErrorMessage(`Error parsing gitleaks repo history output: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
					reject(parseError);
				}
				return;
			}

			if (err) {
				const errorMessage = `Gitleaks repo history scan failed: ${err.message}`;
				console.error(errorMessage, err);
				vscode.window.showErrorMessage(errorMessage);
				reject(err);
				return;
			}

			FindingsHistory.clear();
			resolve(stdout);
		});
	});
}

// Function to parse gitleaks output and highlight findings in VS Code
function parseAndHighlightFindings(output: string, isWorkspaceScan: boolean) {
	const findings = output.split(/\n\n/g).filter(f => f.includes('Finding:'));  // Split findings by empty lines
	DiagnosticCollection.clear();  // Clear previous diagnostics
	DiagnosticsMap.clear(); // Clear the diagnostics map

	if (isWorkspaceScan) {
		DiagnosticCollection.clear(); // Clear previous workspace diagnostics before setting new ones
		FindingsSummary.clear();
	}

	const fileMap = new Map();

	findings.forEach(finding => {
		const secretMatch = finding.match(/Secret:\s+(.*)/);
		const fileMatch = finding.match(/File:\s+(.*)/);
		const lineMatch = finding.match(/Line:\s+(\d+)/);  // Ensure line numbers are parsed correctly
		const ruleIDMatch = finding.match(/RuleID:\s+(.*)/);  // Ensure line numbers are parsed correctly

		if (secretMatch && fileMatch && lineMatch) {
			const secret = secretMatch[1];
			const file = fileMatch[1];
			const line = parseInt(lineMatch[1], 10) - 1;  // Line numbers in VS Code start from 0
			const fileUri = file;
			const ruleID = ruleIDMatch![1];

			FindingsSummary.add({
				file: fileUri,
				line: line,
				secret: secret,
				ruleID: ruleID
			});

			// Accumulate diagnostics per file in the map
			let diagnostics = DiagnosticsMap.get(fileUri) || [];
			const diagnostic = new vscode.Diagnostic(
				new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 150000000)), // For now highlighting whole line because there's no way to determine exact column position with gitleaks. It's possible with vscode extension but it can get resource intensive. Raise a PR to gitleaks later.
				`Potential ${ruleID} type secret detected: ${secret}`,
				vscode.DiagnosticSeverity.Error
			);
			diagnostics.push(diagnostic);
			DiagnosticsMap.set(fileUri, diagnostics);  // Store all diagnostics for the file
		}
	});

	DiagnosticsMap.forEach((diagnostics, fileUri) => {
		if (!fileMap.has(fileUri)) {
			fileMap.set(fileUri, []); // Initialize an empty array if not present
		}

		fileMap.set(fileUri, diagnostics); // Update the map with the new array
	});

	fileMap.forEach((diagnostics, fileUri) => {
		DiagnosticCollection.set(vscode.Uri.file(fileUri), diagnostics);
	});

	// Finally, highlight the secrets for each file
	DiagnosticsMap.forEach((diagnostics, fileUri) => {
		highlightSecretsInFile(fileUri, diagnostics);
	});
}

function highlightSecretsInFile(fileUri: string, diagnostics: vscode.Diagnostic[]) {
	// Open the text document in the background without showing it
	vscode.workspace.openTextDocument(fileUri).then((doc) => {
		// Find if this document is currently open in any editor
		const editor = vscode.window.visibleTextEditors.find(ed => ed.document.uri.toString() === fileUri.toString());

		if (editor) {
			// Prepare decorations for all diagnostics
			const decorations: vscode.DecorationOptions[] = [];  // Collect all ranges for secrets to highlight
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: 'rgba(255, 0, 0, 0.3)',
				border: '1px solid red'
			});

			diagnostics.forEach(diagnostic => {
				decorations.push({ range: diagnostic.range });
			});

			// Apply all decorations at once
			editor.setDecorations(decorationType, decorations);
		} else {
			// If the document is not currently open in any editor, do nothing
			// or handle this case differently depending on your needs
			console.log("Document not currently viewed, skipping decorations.");
		}
	});
}

// Function to parse gitleaks output findings for repository history
export function parseFindingForRepoHistory(output: string) {
	const findings = output.split(/\n\n/g).filter(f => f.includes('Finding:'));  // Split findings by empty lines

	// Clear previous findings for history scans
	FindingsHistory.clear();

	findings.forEach(finding => {
		const secretMatch = finding.match(/Secret:\s+(.*)/);
		const fileMatch = finding.match(/File:\s+(.*)/);
		const lineMatch = finding.match(/Line:\s+(\d+)/);
		const ruleIDMatch = finding.match(/RuleID:\s+(.*)/);
		const commitMatch = finding.match(/Commit:\s+(.*)/);
		const authorMatch = finding.match(/Author:\s+(.*)/);
		const emailMatch = finding.match(/Email:\s+(.*)/);
		const dateMatch = finding.match(/Date:\s+(.*)/);
		const linkMatch = finding.match(/Link:\s+(.*)/);

		if (secretMatch && fileMatch && lineMatch && ruleIDMatch && commitMatch && authorMatch && emailMatch && dateMatch) {
			const secret = secretMatch[1];
			const file = fileMatch[1];
			const line = parseInt(lineMatch[1], 10) - 1;  // Line numbers in VS Code start from 0
			const fileUri = file;
			const ruleID = ruleIDMatch[1];
			const commit = commitMatch[1];
			const author = authorMatch[1];
			const email = emailMatch[1];
			const date = dateMatch[1].slice(0, 10);
			const link = linkMatch ? linkMatch[1] : null;

			FindingsHistory.add({
				file: fileUri,
				line: line,
				secret: secret,
				ruleID: ruleID,
				commit: commit,
				author: author,
				email: email,
				date: date,
				link: link
			});
		}
	});
}
