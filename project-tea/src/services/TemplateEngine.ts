import fs from 'fs';
import path from 'path';

/**
 * Simple template engine for rendering HTML templates
 * Supports basic {{variable}} placeholder replacement
 */
export class TemplateEngine {
  private templateCache: Map<string, string> = new Map();
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, '../templates');
  }

  render(templateName: string, data: Record<string, any> = {}): string {
    const template = this.loadTemplate(templateName);
    return this.replacePlaceholders(template, data);
  }

  private loadTemplate(templateName: string): string {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(this.templatesDir, `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, 'utf-8');

    // Cache the template
    this.templateCache.set(templateName, template);

    return template;
  }

  private replacePlaceholders(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in data) {
        const value = data[key];

        return value !== null && value !== undefined ? String(value) : '';
      }

      return match;
    });
  }

  clearCache(): void {
    this.templateCache.clear();
  }

  templateExists(templateName: string): boolean {
    const templatePath = path.join(this.templatesDir, `${templateName}.html`);
    return fs.existsSync(templatePath);
  }
}