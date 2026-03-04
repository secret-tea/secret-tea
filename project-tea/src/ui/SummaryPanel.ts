import * as vscode from "vscode";
import { TemplateEngine } from "../services/TemplateEngine";
import { FindingsStore } from "../stores/FindingsStore";

/**
 * Manages the Secrets Summary Webview panel
 */
export class SummaryPanel {
	private static currentPanel: SummaryPanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private readonly templateEngine = new TemplateEngine();
	private disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, private findingsStore: FindingsStore) {
		this.panel = panel;

		// Set the webview's initial html content
		this.updateContent();

		// Listen for when the panel is disposed (when user closes the panel)
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		// Refresh content when the panel gets focus
		this.panel.onDidChangeViewState(
			e => {
				if (this.panel.visible) {
					this.updateContent();
				}
			},
			null,
			this.disposables
		);
	}

	/**
	 * Update the summary panel with findings from FindingsStore
	 * @param subscriptions Extension context subscriptions
	 * @param findingsStore The FindingsStore containing history findings
	 */
	public static update(
		subscriptions: vscode.Disposable[],
		findingsStore: FindingsStore
	) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (SummaryPanel.currentPanel) {
			SummaryPanel.currentPanel.panel.reveal(column);
			SummaryPanel.currentPanel.updateContent();
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			'secretsSummary',
			'Secrets Summary',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
			}
		);

		SummaryPanel.currentPanel = new SummaryPanel(panel, findingsStore);
	}

	private updateContent() {
		this.panel.webview.html = this.getHtmlForWebview();
	}

	private getHtmlForWebview(): string {
		const historyFindings = this.findingsStore.getAllHistoryFindings();

		// If no findings, show empty state
		if (historyFindings.length === 0) {
			return this.templateEngine.render('summary-empty');
		}

		const rows = this.generateTableRows(historyFindings);
		return this.templateEngine.render('summary-table', {
			tableRows: rows
		});
	}

	private generateTableRows(findings: any[]): string {
		return findings.map(secret => {
			const safeDate = this.escapeHtml(secret.date);
			const safeAuthor = this.escapeHtml(secret.author);
			const safeEmail = this.escapeHtml(secret.email);
			const safeCommit = this.escapeHtml(secret.commit.slice(0, 12));
			const safeFile = this.escapeHtml(secret.file);
			const safeLine = secret.line + 1;
			const safeRuleID = this.escapeHtml(secret.ruleID);
			const safeSecret = this.escapeHtml(secret.secret);
			const safeLink = secret.link ? this.escapeHtml(secret.link) : '';

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

	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	public dispose() {
		SummaryPanel.currentPanel = undefined;

		// Clean up our resources
		this.panel.dispose();

		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}
}
