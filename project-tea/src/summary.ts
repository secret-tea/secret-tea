import { FindingsHistory } from "./utils/gitleaks";
import * as vscode from "vscode";

let summaryPanel: vscode.WebviewPanel | null;

export function UpdateSummary(subscriptions: vscode.ExtensionContext["subscriptions"]) {
	if (summaryPanel) {
		// If the panel is already open, update its content 
		summaryPanel.webview.html = GetSecretsSummaryHtml();
		summaryPanel.reveal(vscode.ViewColumn.One);
	} else {
		// Create the panel
		summaryPanel = vscode.window.createWebviewPanel(
			'secretsSummary',
			'Secrets Summary',
			vscode.ViewColumn.One,
			{}
		);
		summaryPanel.webview.html = GetSecretsSummaryHtml();
		summaryPanel.onDidDispose(() => {
			summaryPanel = null;
		}, null, subscriptions);

		// Refresh content when the panel gets focus
		summaryPanel.onDidChangeViewState(e => {
			if (summaryPanel && summaryPanel.visible) {
					refreshsummaryPanel();
			}
		});
	}
}

/// Refresh summary page with updated results
function refreshsummaryPanel() {
	if (summaryPanel) {
		summaryPanel.webview.html = GetSecretsSummaryHtml();
	}
}

export function GetSecretsSummaryHtml() {
	if (FindingsHistory.size === 0) {
		return `
		<html>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Secrets Found in Commit History</title>
				<style>
					body {
						font-family: "Segoe UI", Roboto, sans-serif;
						background-color: #1e1e1e;
						color: #e4e6eb;
						margin: 0;
						padding: 20px;
					}
					h1 {
						text-align: center;
						margin-bottom: 1.2em;
						color: #f0f0f0;
					}
					.no-secrets-message {
						margin: 40px auto;
						padding: 32px 24px;
						max-width: 480px;
						background: #252526;
						border-radius: 8px;
						box-shadow: 0 3px 6px rgba(0,0,0,0.4);
						text-align: center;
						font-size: 1.25em;
						color: #b0b0b0;
					}
				</style>
			</head>
			<body>
				<div class="no-secrets-message">
					No secrets were found.
				</div>
			</body>
		</html>
		`;
	}

	const rows = Array.from(FindingsHistory).map(secret => {
		return `
			<tr>
				<td>${secret.date}</td>
				<td>${secret.author}</td>
				<td>${secret.email}</td>
				<td>${secret.commit.slice(0, 12)}</td>
				<td><a href='${secret.line}' target="_blank">${secret.line}</a></td>
				<td>${secret.line + 1}</td>
				<td>${secret.ruleID}</td>
				<td>${secret.secret}</td>
				<td><a href='${secret.link}' target="_blank">${secret.link}</a></td>
			</tr>
		`;
	}).join('');

	return `
		<html>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Secrets Found in Commit History</title>
				<style>
					body {
						font-family: "Segoe UI", Roboto, sans-serif;
						background-color: #1e1e1e;
						color: #e4e6eb;
						margin: 0;
						padding: 20px;
					}

					h1 {
						text-align: center;
						margin-bottom: 1.2em;
						color: #f0f0f0;
					}

					.table-container {
						overflow-x: auto;
						background-color: #252526;
						border-radius: 8px;
						box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
					}

					table {
						width: 100%;
						border-collapse: collapse;
						min-width: 980px;
					}

					th, td {
						padding: 10px 14px;
						text-align: left;
						border-bottom: 1px solid #3a3a3a;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
					}

					th {
						background-color: #323233;
						color: #cfcfcf;
						position: sticky;
						top: 0;
						z-index: 2;
						text-transform: uppercase;
						font-size: 13px;
						letter-spacing: 0.5px;
					}

					tr:nth-child(even) {
						background-color: #2a2a2a;
					}

					tr:hover {
						background-color: #30363b;
					}

					a {
						color: #4e9af1;
						text-decoration: none;
					}

					a:hover {
						color: #82cfff;
						text-decoration: underline;
					}

					@media (max-width: 768px) {
						table {
							font-size: 13px;
						}
						th, td {
							padding: 8px 10px;
						}
					}
				</style>
			</head>
			<body>
				<div class="table-container">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Author</th>
								<th>Email</th>
								<th>Commit</th>
								<th>File</th>
								<th>Line</th>
								<th>Rule ID</th>
								<th>Secret</th>
								<th>Link</th>
							</tr>
						</thead>
						<tbody>
							${rows}
						</tbody>
					</table>
				</div>
			</body>
		</html>
	`;
}