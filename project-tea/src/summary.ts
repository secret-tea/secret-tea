import * as vscode from "vscode";
import { TemplateEngine } from "./services/TemplateEngine";
import { FindingsStore } from "./stores/FindingsStore";

let summaryPanel: vscode.WebviewPanel | null;
const templateEngine = new TemplateEngine();
let currentFindingsStore: FindingsStore | null = null;

/**
 * Update the summary panel with findings from FindingsStore
 * @param subscriptions Extension context subscriptions
 * @param findingsStore The FindingsStore containing history findings
 */
export function UpdateSummary(
	subscriptions: vscode.ExtensionContext["subscriptions"],
	findingsStore: FindingsStore
) {
	// Store reference to findings store
	currentFindingsStore = findingsStore;

	if (summaryPanel) {
		// If the panel is already open, update its content
		summaryPanel.webview.html = GetSecretsSummaryHtml(findingsStore);
		summaryPanel.reveal(vscode.ViewColumn.One);
	} else {
		// Create the panel
		summaryPanel = vscode.window.createWebviewPanel(
			'secretsSummary',
			'Secrets Summary',
			vscode.ViewColumn.One,
			{}
		);
		summaryPanel.webview.html = GetSecretsSummaryHtml(findingsStore);
		summaryPanel.onDidDispose(() => {
			summaryPanel = null;
			currentFindingsStore = null;
		}, null, subscriptions);

		// Refresh content when the panel gets focus
		summaryPanel.onDidChangeViewState(e => {
			if (summaryPanel && summaryPanel.visible && currentFindingsStore) {
				refreshSummaryPanel(currentFindingsStore);
			}
		});
	}
}

/**
 * Refresh summary panel with updated results
 * @param findingsStore The FindingsStore containing history findings
 */
function refreshSummaryPanel(findingsStore: FindingsStore) {
	if (summaryPanel) {
		summaryPanel.webview.html = GetSecretsSummaryHtml(findingsStore);
	}
}

/**
 * Generate HTML for secrets summary
 * Uses template files from src/templates/
 * @param findingsStore The FindingsStore containing history findings
 * @returns HTML string for webview
 */
export function GetSecretsSummaryHtml(findingsStore: FindingsStore): string {
	// Get history findings from store
	const historyFindings = findingsStore.getAllHistoryFindings();

	// If no findings, show empty state
	if (historyFindings.length === 0) {
		return templateEngine.render('summary-empty');
	}

	// Generate table rows from findings
	const rows = generateTableRows(historyFindings);

	// Render template with table rows
	return templateEngine.render('summary-table', {
		tableRows: rows
	});
}

/**
 * Generate HTML table rows from findings history
 * @param findings Array of history findings
 * @returns HTML string containing table rows
 */
function generateTableRows(findings: any[]): string {
	return findings.map(secret => {
		// Escape HTML to prevent XSS
		const safeDate = escapeHtml(secret.date);
		const safeAuthor = escapeHtml(secret.author);
		const safeEmail = escapeHtml(secret.email);
		const safeCommit = escapeHtml(secret.commit.slice(0, 12));
		const safeFile = escapeHtml(secret.file);
		const safeLine = secret.line + 1; // Convert to 1-indexed
		const safeRuleID = escapeHtml(secret.ruleID);
		const safeSecret = escapeHtml(secret.secret);
		const safeLink = secret.link ? escapeHtml(secret.link) : '';

		return `
			<tr>
				<td>${safeDate}</td>
				<td>${safeAuthor}</td>
				<td>${safeEmail}</td>
				<td>${safeCommit}</td>
				<td><a href="${safeFile}" target="_blank">${safeFile}</a></td>
				<td>${safeLine}</td>
				<td>${safeRuleID}</td>
				<td>${safeSecret}</td>
				<td>${safeLink ? `<a href="${safeLink}" target="_blank">${safeLink}</a>` : ''}</td>
			</tr>
		`;
	}).join('');
}

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param unsafe String that may contain HTML special characters
 * @returns Safe HTML string
 */
function escapeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}