import { GitleaksOutputParser } from '../../../parsers/GitleaksOutputParser';
import { WorkspaceFinding, HistoryFinding } from '../../../services/interfaces';
import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Integration tests for GitleaksOutputParser.
 *
 * Tests parse real Gitleaks-style text output (verbose CLI format)
 * without spawning any process — pure string transformation.
 */
describe('GitleaksOutputParser (Integration)', () => {
  let parser: GitleaksOutputParser;

  beforeEach(() => {
    parser = new GitleaksOutputParser();
  });

  // ─── Shared fixtures ─────────────────────────────────────────────────────────

  const workspaceBlock = `
Finding:     -----BEGIN RSA PRIVATE KEY-----
Secret:      -----BEGIN RSA PRIVATE KEY-----
RuleID:      rsa-private-key
Entropy:     0.00
File:        src/config/keys.ts
Line:        5
Fingerprint: abc123
`.trimStart();

  const workspaceBlock2 = `
Finding:     AKIAIOSFODNN7EXAMPLE
Secret:      AKIAIOSFODNN7EXAMPLE
RuleID:      aws-access-token
Entropy:     3.50
File:        src/config/aws.ts
Line:        12
Fingerprint: def456
`.trimStart();

  const historyBlock = `
Finding:     ghp_XXXXXXXXXXXXXXXXXXXX
Secret:      ghp_XXXXXXXXXXXXXXXXXXXX
RuleID:      github-pat
Entropy:     3.80
File:        scripts/deploy.sh
Line:        3
Commit:      a1b2c3d4e5f6
Author:      Alice
Email:       alice@example.com
Date:        2024-01-15T10:30:00Z
Link:        https://github.com/org/repo/commit/a1b2c3d4e5f6
Fingerprint: ghi789
`.trimStart();

  // ─── Workspace scan parsing ───────────────────────────────────────────────

  describe('parseWorkspaceScan', () => {
    it('should parse a single workspace finding correctly', () => {
      const findings: WorkspaceFinding[] = parser.parseWorkspaceScan(workspaceBlock);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        secret: '-----BEGIN RSA PRIVATE KEY-----',
        file: 'src/config/keys.ts',
        line: 4, // 1-based "5" → 0-based "4"
        ruleID: 'rsa-private-key',
      });
    });

    it('should parse multiple workspace findings from a multi-block output', () => {
      const rawOutput = workspaceBlock + '\n\n' + workspaceBlock2;
      const findings: WorkspaceFinding[] = parser.parseWorkspaceScan(rawOutput);

      expect(findings).toHaveLength(2);
      expect(findings[0].ruleID).toBe('rsa-private-key');
      expect(findings[1].ruleID).toBe('aws-access-token');
      expect(findings[1].line).toBe(11); // 1-based "12" → 0-based "11"
    });

    it('should return an empty array for an empty string', () => {
      expect(parser.parseWorkspaceScan('')).toEqual([]);
    });

    it('should return an empty array for whitespace-only input', () => {
      expect(parser.parseWorkspaceScan('   \n\n   ')).toEqual([]);
    });

    it('should skip incomplete blocks that are missing required fields', () => {
      // Missing "File:" field
      const incompleteBlock = `
Finding:     some-value
Secret:      some-value
RuleID:      some-rule
Line:        1
Fingerprint: xyz
`.trimStart();
      expect(parser.parseWorkspaceScan(incompleteBlock)).toEqual([]);
    });

    it('should correctly convert 1-based line numbers to 0-based', () => {
      const findings = parser.parseWorkspaceScan(workspaceBlock);
      expect(findings[0].line).toBe(4); // Line: 5 → 4
    });
  });

  // ─── History scan parsing ─────────────────────────────────────────────────

  describe('parseHistoryScan', () => {
    it('should parse a single history finding correctly', () => {
      const findings: HistoryFinding[] = parser.parseHistoryScan(historyBlock);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        secret: 'ghp_XXXXXXXXXXXXXXXXXXXX',
        file: 'scripts/deploy.sh',
        line: 2, // 1-based "3" → 0-based "2"
        ruleID: 'github-pat',
        commit: 'a1b2c3d4e5f6',
        author: 'Alice',
        email: 'alice@example.com',
        date: '2024-01-15',         // only YYYY-MM-DD extracted
        link: 'https://github.com/org/repo/commit/a1b2c3d4e5f6',
      });
    });

    it('should return an empty array for an empty input', () => {
      expect(parser.parseHistoryScan('')).toEqual([]);
    });

    it('should skip history blocks missing required fields (e.g. no commit)', () => {
      // Missing "Commit:" field
      const incomplete = `
Finding:     ghp_XXXX
Secret:      ghp_XXXX
RuleID:      github-pat
File:        deploy.sh
Line:        1
Author:      Bob
Email:       bob@example.com
Date:        2024-02-01T00:00:00Z
`.trimStart();
      expect(parser.parseHistoryScan(incomplete)).toEqual([]);
    });

    it('should handle a null link field gracefully', () => {
      const noLink = historyBlock.replace(/^Link:.*$/m, '').trim();
      const findings = parser.parseHistoryScan(noLink + '\n');
      // link can be null when the field is absent
      if (findings.length > 0) {
        expect(findings[0].link).toBeNull();
      }
    });
  });
});
