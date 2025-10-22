import * as vscode from "vscode";

export const DiagnosticCollection = vscode.languages.createDiagnosticCollection('project-tea');
export const DiagnosticsMap = new Map(); // Map to store diagnostics per file

export function ClearDiagnostics() {
	DiagnosticCollection.clear();
	DiagnosticCollection.dispose();
}