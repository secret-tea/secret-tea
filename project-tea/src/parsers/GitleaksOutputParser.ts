import { HistoryFinding, WorkspaceFinding } from '../services/interfaces';

// GitleaksOutputParser converts raw text output into structured Finding objects
export class GitleaksOutputParser {
  parseWorkspaceScan(scanResult: string): WorkspaceFinding[] {
    const findings: WorkspaceFinding[] = [];
    const blocks = this.splitIntoBlocks(scanResult);

    for (const block of blocks) {
      const finding = this.parseWorkspaceBlock(block);
      if (finding) {
        findings.push(finding);
      }
    }

    return findings;
  }

  parseHistoryScan(scanResult: string): HistoryFinding[] {
    const findings: HistoryFinding[] = [];
    const blocks = this.splitIntoBlocks(scanResult);

    for (const block of blocks) {
      const finding = this.parseHistoryBlock(block);
      if (finding) {
        findings.push(finding);
      }
    }

    return findings;
  }

  private splitIntoBlocks(output: string): string[] {
    if (!output || output.trim().length === 0) {
      return [];
    }

    return output.split(/\n\n/g).filter(block => block.includes('Finding:'));
  }

  private parseWorkspaceBlock(block: string): WorkspaceFinding | null {
    const secret = this.extractField(block, 'Secret');
    const file = this.extractField(block, 'File');
    const lineStr = this.extractField(block, 'Line');
    const ruleID = this.extractField(block, 'RuleID');

    // All fields are required for a valid finding
    if (!secret || !file || !lineStr || !ruleID) {
      return null;
    }

    return {
      secret: secret.trim(),
      file: file.trim(),
      line: parseInt(lineStr, 10) - 1, // Convert to 0-indexed for VS Code
      ruleID: ruleID.trim()
    };
  }

  private parseHistoryBlock(block: string): HistoryFinding | null {
    const secret = this.extractField(block, 'Secret');
    const file = this.extractField(block, 'File');
    const lineStr = this.extractField(block, 'Line');
    const ruleID = this.extractField(block, 'RuleID');
    const commit = this.extractField(block, 'Commit');
    const author = this.extractField(block, 'Author');
    const email = this.extractField(block, 'Email');
    const date = this.extractField(block, 'Date');
    const link = this.extractField(block, 'Link');

    // All fields except link are required
    if (!secret || !file || !lineStr || !ruleID || !commit || !author || !email || !date) {
      return null;
    }

    // Extract just the date part (YYYY-MM-DD) from the full timestamp
    const dateOnly = date.slice(0, 10);

    return {
      secret: secret.trim(),
      file: file.trim(),
      line: parseInt(lineStr, 10) - 1, // Convert to 0-indexed for VS Code
      ruleID: ruleID.trim(),
      commit: commit.trim(),
      author: author.trim(),
      email: email.trim(),
      date: dateOnly,
      link: link ? link.trim() : null
    };
  }

  private extractField(block: string, fieldName: string): string | null {
    const regex = new RegExp(`${fieldName}:\\s+(.+?)(?=\\n|$)`, 'm');
    const match = block.match(regex);
    return match ? match[1] : null;
  }
}