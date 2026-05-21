import * as fs from 'fs';
import { TemplateEngine } from '../../../services/TemplateEngine';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the fs module
jest.mock('fs', () => {
  const original = jest.requireActual('fs') as object;
  return {
    ...original,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
    jest.clearAllMocks();
  });

  // ── render / replacePlaceholders ──────────────────────────────────────────
  describe('render', () => {
    it('should replace {{key}} placeholders with values from data object', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<h1>{{title}}</h1><p>{{body}}</p>');

      const result = engine.render('myTemplate', { title: 'Hello', body: 'World' });

      expect(result).toBe('<h1>Hello</h1><p>World</p>');
    });

    it('should leave unknown placeholders unreplaced', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<p>{{known}} {{unknown}}</p>');

      const result = engine.render('myTemplate', { known: 'value' });

      expect(result).toBe('<p>value {{unknown}}</p>');
    });

    it('should replace null value with empty string', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('value: {{val}}');

      const result = engine.render('myTemplate', { val: null });

      expect(result).toBe('value: ');
    });

    it('should replace undefined value with empty string', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('value: {{val}}');

      const result = engine.render('myTemplate', { val: undefined });

      expect(result).toBe('value: ');
    });

    it('should convert numeric values to string', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('count: {{count}}');

      const result = engine.render('myTemplate', { count: 42 });

      expect(result).toBe('count: 42');
    });

    it('should work with empty data object (no replacements)', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<p>{{placeholder}}</p>');

      const result = engine.render('myTemplate', {});

      expect(result).toBe('<p>{{placeholder}}</p>');
    });
  });

  // ── loadTemplate (caching) ────────────────────────────────────────────────
  describe('loadTemplate caching', () => {
    it('should read the file only once for repeated renders of the same template', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<p>{{x}}</p>');

      engine.render('cached', { x: '1' });
      engine.render('cached', { x: '2' });

      // readFileSync should only have been called once due to caching
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('clearCache should force re-reading the file on next render', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<p>{{x}}</p>');

      engine.render('my', { x: 'first' });
      engine.clearCache();
      engine.render('my', { x: 'second' });

      // readFileSync should have been called twice (once before clear, once after)
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  // ── loadTemplate (error) ──────────────────────────────────────────────────
  describe('loadTemplate error handling', () => {
    it('should throw when the template file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => engine.render('nonexistent', {})).toThrow(/Template not found/);
    });
  });

  // ── templateExists ────────────────────────────────────────────────────────
  describe('templateExists', () => {
    it('should return true when the template file exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      expect(engine.templateExists('mine')).toBe(true);
    });

    it('should return false when the template file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(engine.templateExists('missing')).toBe(false);
    });
  });
});
