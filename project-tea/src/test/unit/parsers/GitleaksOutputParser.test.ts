import { GitleaksOutputParser } from '../../../parsers/GitleaksOutputParser';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('GitleaksOutputParser', () => {
  let parser: GitleaksOutputParser;

  beforeEach(() => {
    parser = new GitleaksOutputParser();
  });

  describe('parseWorkspaceScan', () => {
    it('should return empty array for empty string', () => {
      expect(parser.parseWorkspaceScan('')).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
      expect(parser.parseWorkspaceScan('   \n  ')).toEqual([]);
    });

    it('should return empty array when no Finding: blocks present', () => {
      const output = 'some random output\nwithout any secret blocks';
      expect(parser.parseWorkspaceScan(output)).toEqual([]);
    });

    it('should parse a single valid workspace block correctly', () => {
      const output = [
        'Finding:     AKIAIOSFODNN7EXAMPLE',
        'Secret:      AKIAIOSFODNN7EXAMPLE',
        'RuleID:      aws-access-key-id',
        'Entropy:     3.58',
        'File:        src/config.ts',
        'Line:        42',
      ].join('\n');

      const findings = parser.parseWorkspaceScan(output);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toEqual({
        secret: 'AKIAIOSFODNN7EXAMPLE',
        ruleID: 'aws-access-key-id',
        file: 'src/config.ts',
        line: 41, // 1-based → 0-based
      });
    });

    it('should convert Gitleaks 1-based line number to 0-based', () => {
      const output = [
        'Finding:     secret',
        'Secret:      secret',
        'RuleID:      generic-api-key',
        'File:        file.ts',
        'Line:        1',
      ].join('\n');

      const findings = parser.parseWorkspaceScan(output);
      expect(findings[0].line).toBe(0);
    });

    it('should skip a block that is missing a required field', () => {
      // Missing "File" field
      const output = [
        'Finding:     secret',
        'Secret:      secret',
        'RuleID:      generic-api-key',
        'Line:        5',
      ].join('\n');

      expect(parser.parseWorkspaceScan(output)).toEqual([]);
    });

    it('should parse multiple blocks separated by double newlines', () => {
      const block1 = [
        'Finding:     secret1',
        'Secret:      secret1',
        'RuleID:      rule-one',
        'File:        a.ts',
        'Line:        10',
      ].join('\n');

      const block2 = [
        'Finding:     secret2',
        'Secret:      secret2',
        'RuleID:      rule-two',
        'File:        b.ts',
        'Line:        20',
      ].join('\n');

      const output = `${block1}\n\n${block2}`;

      const findings = parser.parseWorkspaceScan(output);
      expect(findings).toHaveLength(2);
      expect(findings[0].secret).toBe('secret1');
      expect(findings[1].secret).toBe('secret2');
    });

    it('should trim whitespace from field values', () => {
      const output = [
        'Finding:     secret   ',
        'Secret:      secret   ',
        'RuleID:      rule-id   ',
        'File:        src/file.ts   ',
        'Line:        3',
      ].join('\n');

      const findings = parser.parseWorkspaceScan(output);
      expect(findings[0].secret).toBe('secret');
      expect(findings[0].ruleID).toBe('rule-id');
      expect(findings[0].file).toBe('src/file.ts');
    });
  });


  describe('parseHistoryScan', () => {
    it('should return empty array for empty string', () => {
      expect(parser.parseHistoryScan('')).toEqual([]);
    });

    it('should parse a single valid history block correctly', () => {
      const output = [
        'Finding:     AKIAIOSFODNN7EXAMPLE',
        'Secret:      AKIAIOSFODNN7EXAMPLE',
        'RuleID:      aws-access-key-id',
        'Entropy:     3.58',
        'File:        src/config.ts',
        'Line:        5',
        'Commit:      abc1234567890abcdef',
        'Author:      John Doe',
        'Email:       john@example.com',
        'Date:        2023-06-15T12:00:00Z',
        'Link:        https://github.com/org/repo/commit/abc1234',
      ].join('\n');

      const findings = parser.parseHistoryScan(output);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toEqual({
        secret: 'AKIAIOSFODNN7EXAMPLE',
        ruleID: 'aws-access-key-id',
        file: 'src/config.ts',
        line: 4, // 0-based
        commit: 'abc1234567890abcdef',
        author: 'John Doe',
        email: 'john@example.com',
        date: '2023-06-15', // truncated to YYYY-MM-DD
        link: 'https://github.com/org/repo/commit/abc1234',
      });
    });

    it('should set link to null when Link field is absent', () => {
      const output = [
        'Finding:     mysecret',
        'Secret:      mysecret',
        'RuleID:      generic',
        'File:        src/x.ts',
        'Line:        1',
        'Commit:      aabbcc',
        'Author:      Dev',
        'Email:       dev@dev.com',
        'Date:        2024-01-01T00:00:00Z',
      ].join('\n');

      const findings = parser.parseHistoryScan(output);
      expect(findings).toHaveLength(1);
      expect(findings[0].link).toBeNull();
    });

    it('should truncate Date to YYYY-MM-DD regardless of time component', () => {
      const output = [
        'Finding:     tok',
        'Secret:      tok',
        'RuleID:      rule',
        'File:        f.ts',
        'Line:        2',
        'Commit:      deadbeef',
        'Author:      A',
        'Email:       a@a.com',
        'Date:        2025-12-31T23:59:59+07:00',
      ].join('\n');

      const findings = parser.parseHistoryScan(output);
      expect(findings[0].date).toBe('2025-12-31');
    });

    it('should skip history block missing a required field (e.g. Commit)', () => {
      const output = [
        'Finding:     tok',
        'Secret:      tok',
        'RuleID:      rule',
        'File:        f.ts',
        'Line:        2',
        // Missing Commit, Author, Email, Date
      ].join('\n');

      expect(parser.parseHistoryScan(output)).toEqual([]);
    });

    it('should parse multiple history blocks', () => {
      const makeBlock = (secret: string, commit: string) => [
        `Finding:     ${secret}`,
        `Secret:      ${secret}`,
        'RuleID:      rule',
        'File:        f.ts',
        'Line:        1',
        `Commit:      ${commit}`,
        'Author:      A',
        'Email:       a@a.com',
        'Date:        2024-01-01T00:00:00Z',
      ].join('\n');

      const output = `${makeBlock('secret1', 'commit1')}\n\n${makeBlock('secret2', 'commit2')}`;

      const findings = parser.parseHistoryScan(output);
      expect(findings).toHaveLength(2);
      expect(findings[0].commit).toBe('commit1');
      expect(findings[1].commit).toBe('commit2');
    });
  });
});
