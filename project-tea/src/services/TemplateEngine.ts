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
    // Templates are located relative to the compiled output
    this.templatesDir = path.join(__dirname, '../templates');
  }

  /**
   * Render a template with the given data
   * @param templateName Name of the template file (without extension)
   * @param data Object containing values to replace in template
   * @returns Rendered HTML string
   */
  render(templateName: string, data: Record<string, any> = {}): string {
    const template = this.loadTemplate(templateName);
    return this.replacePlaceholders(template, data);
  }

  // Load a template from file (with caching)
  private loadTemplate(templateName: string): string {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // Load from file
    const templatePath = path.join(this.templatesDir, `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, 'utf-8');

    // Cache the template
    this.templateCache.set(templateName, template);

    return template;
  }

  // Replace {{placeholders}} in template with actual values
  private replacePlaceholders(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in data) {
        const value = data[key];
        // Convert to string, handling null/undefined
        return value !== null && value !== undefined ? String(value) : '';
      }
      // Leave placeholder as-is if no data provided
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