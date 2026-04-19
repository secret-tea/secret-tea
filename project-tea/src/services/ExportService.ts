import * as vscode from 'vscode';
import * as fs from 'fs';
import { WorkspaceFinding, HistoryFinding } from './interfaces';
import { MalwareVulnerability } from '../stores/MalwareStore';
import PDFDocument from 'pdfkit';

const C = {
  headerBg : '#1a1a2e',
  headerFg : '#ffffff',
  rowAlt   : '#f1f5f9',
  rowFg    : '#1e293b',
  accent   : '#334155',
  muted    : '#6b7280',
  border   : '#cbd5e1',
};

export class ExportService {
  constructor() {}

  public async promptSaveLocation(defaultName: string, filters: { [name: string]: string[] }): Promise<vscode.Uri | undefined> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: filters
    });
    return uri;
  }

  public async exportSecretsToJson(workspace: WorkspaceFinding[], history: HistoryFinding[], uri: vscode.Uri): Promise<void> {
    const data = {
      workspaceFindings: workspace,
      historyFindings: history,
      generatedAt: new Date().toISOString()
    };
    await fs.promises.writeFile(uri.fsPath, JSON.stringify(data, null, 2), 'utf8');
  }

  public async exportMalwareToJson(vulnerabilities: MalwareVulnerability[], uri: vscode.Uri): Promise<void> {
    const data = {
      malwareFindings: vulnerabilities,
      generatedAt: new Date().toISOString()
    };
    await fs.promises.writeFile(uri.fsPath, JSON.stringify(data, null, 2), 'utf8');
  }

  public async exportWorkspaceSecretsToCsv(workspace: WorkspaceFinding[], uri: vscode.Uri): Promise<void> {
    const headers = ['file', 'line', 'ruleID', 'secret'];
    const rows: string[] = [headers.map(this.escapeCsv).join(',')];
    for (const fw of workspace) {
      rows.push([
        fw.file, fw.line.toString(), fw.ruleID, fw.secret
      ].map(this.escapeCsv).join(','));
    }
    await fs.promises.writeFile(uri.fsPath, rows.join('\r\n'), 'utf-8');
  }

  public async exportHistorySecretsToCsv(history: HistoryFinding[], uri: vscode.Uri): Promise<void> {
    const headers = ['file', 'line', 'ruleID', 'secret', 'commit', 'author', 'email', 'date', 'link'];
    const rows: string[] = [headers.map(this.escapeCsv).join(',')];
    for (const fh of history) {
      rows.push([
        fh.file, fh.line.toString(), fh.ruleID, fh.secret,
        fh.commit, fh.author, fh.email, fh.date, fh.link || ''
      ].map(this.escapeCsv).join(','));
    }
    await fs.promises.writeFile(uri.fsPath, rows.join('\r\n'), 'utf-8');
  }

  public async exportMalwareToCsv(vulnerabilities: MalwareVulnerability[], uri: vscode.Uri): Promise<void> {
    const headers = ['Package', 'Version', 'Reason', 'File'];
    const rows: string[] = [headers.map(this.escapeCsv).join(',')];
    for (const v of vulnerabilities) {
      rows.push([
        v.packageName, v.version, v.reason, v.filePath || ''
      ].map(this.escapeCsv).join(','));
    }
    await fs.promises.writeFile(uri.fsPath, rows.join('\r\n'), 'utf-8');
  }

  public async exportSecretsToPdf(workspace: WorkspaceFinding[], history: HistoryFinding[], uri: vscode.Uri): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
        const stream = fs.createWriteStream(uri.fsPath);
        doc.pipe(stream);
        stream.on('finish', resolve);
        stream.on('error', reject);

        // Title
        this.drawTitle(doc, 'Secret Tea — Scan Report');

        // Workspace section
        this.drawSectionHeading(doc, `Workspace Findings (${workspace.length})`);
        if (workspace.length > 0) {
          const wsHeaders = ['File', 'Line', 'Rule ID', 'Secret'];
          const wsCols    = [260, 45, 120, 335]; // px widths, total ~760
          const wsRows    = workspace.map(w => [w.file, w.line.toString(), w.ruleID, w.secret]);
          this.drawTable(doc, wsHeaders, wsRows, wsCols);
        } else {
          this.drawEmpty(doc, 'No workspace findings.');
        }

        // History section
        this.drawSectionHeading(doc, `Git History Findings (${history.length})`);
        if (history.length > 0) {
          const hHeaders = ['Date', 'Author', 'Email', 'Commit', 'File', 'Line', 'Rule ID', 'Secret', 'Link'];
          const hCols    = [50, 60, 120, 50, 170, 30, 80, 200, 40];
          const hRows    = history.map(h => [h.date, h.author, h.email, h.commit.substring(0, 8), h.file, h.line.toString(), h.ruleID, h.secret, h.link || '']);
          this.drawTable(doc, hHeaders, hRows, hCols, new Set([8]));
        } else {
          this.drawEmpty(doc, 'No git history findings.');
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  public async exportMalwareToPdf(vulnerabilities: MalwareVulnerability[], uri: vscode.Uri): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
        const stream = fs.createWriteStream(uri.fsPath);
        doc.pipe(stream);
        stream.on('finish', resolve);
        stream.on('error', reject);

        this.drawTitle(doc, 'Secret Tea — Malware Scan Report');

        this.drawSectionHeading(doc, `Malware Findings (${vulnerabilities.length})`);
        if (vulnerabilities.length > 0) {
          const headers = ['Package', 'Version', 'Reason', 'File Location'];
          const cols    = [200, 80, 120, 230];
          const rows    = vulnerabilities.map(v => [v.packageName, v.version, v.reason, v.filePath || '-']);
          this.drawTable(doc, headers, rows, cols);
        } else {
          this.drawEmpty(doc, 'No malware vulnerabilities detected.');
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private drawTitle(doc: PDFKit.PDFDocument, title: string): void {
    doc.fontSize(18).fillColor(C.headerBg).font('Helvetica-Bold').text(title, { align: 'left' });
    doc.fontSize(9).fillColor(C.muted).font('Helvetica')
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'left' });
    doc.moveDown(0.8);
  }

  private drawSectionHeading(doc: PDFKit.PDFDocument, text: string): void {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(C.accent).font('Helvetica-Bold').text(text);
    doc.moveDown(0.3);
  }

  private drawEmpty(doc: PDFKit.PDFDocument, text: string): void {
    doc.fontSize(9).fillColor(C.muted).font('Helvetica-Oblique').text(text);
    doc.moveDown(0.5);
  }

  /**
   * Draw a simple table at the current Y position.
   * cols: array of column widths in points (must sum ≤ page width - margins).
   */
  private drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], cols: number[], linkCols: Set<number> = new Set()): void {
    const margin   = 36;
    const rowH     = 18;   // min row height
    const cellPad  = 4;
    const headerH  = 20;

    let x = margin;
    let y = doc.y;

    // ── header row ──────────────────────────────────────────────────────────
    headers.forEach((h, i) => {
      doc.rect(x, y, cols[i], headerH).fill(C.accent);
      doc.fontSize(8).fillColor(C.headerFg).font('Helvetica-Bold')
         .text(h, x + cellPad, y + 5, { width: cols[i] - cellPad * 2, lineBreak: false });
      x += cols[i];
    });
    y += headerH;

    // ── data rows ────────────────────────────────────────────────────────────
    rows.forEach((row, ri) => {
      // Measure tallest cell to set row height
      const cellHeights = row.map((cell, ci) => {
        doc.fontSize(8);
        const measured = doc.heightOfString(cell || '-', {
          width: cols[ci] - cellPad * 2,
        });
        return measured + cellPad * 2;
      });
      const rh = Math.max(rowH, ...cellHeights);

      // Page break guard
      const pageH = doc.page.height - doc.page.margins.bottom;
      if (y + rh > pageH) {
        doc.addPage();
        y = doc.page.margins.top;
        // Redraw header on new page
        x = margin;
        headers.forEach((h, i) => {
          doc.rect(x, y, cols[i], headerH).fill(C.accent);
          doc.fontSize(8).fillColor(C.headerFg).font('Helvetica-Bold')
             .text(h, x + cellPad, y + 5, { width: cols[i] - cellPad * 2, lineBreak: false });
          x += cols[i];
        });
        y += headerH;
      }

      // Alt row bg
      x = margin;
      const bg = ri % 2 === 1 ? C.rowAlt : '#ffffff';
      const totalW = cols.reduce((a, b) => a + b, 0);
      doc.rect(x, y, totalW, rh).fill(bg);

      // Cell text
      row.forEach((cell, ci) => {
        if (linkCols.has(ci) && cell) {
          // Render as clickable "repo" hyperlink
          doc.fontSize(8).fillColor('#2563eb').font('Helvetica')
             .text('repo', x + cellPad, y + cellPad, {
               width: cols[ci] - cellPad * 2,
               lineBreak: false,
               link: cell,
               underline: true,
             });
        } else {
          doc.fontSize(8).fillColor(C.rowFg).font('Helvetica')
             .text(cell || '-', x + cellPad, y + cellPad, {
               width: cols[ci] - cellPad * 2,
               lineBreak: true,
             });
        }
        x += cols[ci];
      });

      // Bottom border
      x = margin;
      const tw = cols.reduce((a, b) => a + b, 0);
      doc.moveTo(x, y + rh).lineTo(x + tw, y + rh).strokeColor(C.border).lineWidth(0.5).stroke();

      y += rh;
    });

    doc.x = margin;
    doc.y = y + 4;
  }

  private escapeCsv(val: string): string {
    if (val === undefined || val === null) { return ''; }
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }
}
