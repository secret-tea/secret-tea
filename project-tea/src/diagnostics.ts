import * as vscode from "vscode";

export const DiagnosticCollection = vscode.languages.createDiagnosticCollection('project-tea');
export const DiagnosticsMap = new Map();

export function ClearDiagnostics() {
	DiagnosticCollection.clear();
	DiagnosticCollection.dispose();
}