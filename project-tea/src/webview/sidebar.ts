// VS Code API
declare const vscode: {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

interface GroupedFindings {
  [filePath: string]: Finding[];
}

interface Finding {
  secret: string;
  ruleID: string;
  file: string;
  line: number;
}

interface WebviewState {
  expandedFiles: Set<string>;
  lastUpdate: number;
}

/**
 * Main sidebar controller class
 */
class SidebarController {
  private container: HTMLElement | null = null;
  private state: WebviewState;
  private renderRequestId: number | null = null;
  private selectedFile: string | null = null;

  constructor() {
    // Restore state or initialize
    const savedState = vscode.getState();
    this.state = {
      expandedFiles: new Set(savedState?.expandedFiles || []),
      lastUpdate: savedState?.lastUpdate || 0
    };

    this.initialize();
  }

  /**
   * Initialize the sidebar
   */
  private initialize(): void {
    // Get DOM elements
    this.container = document.getElementById('secretsList');

    if (!this.container) {
      console.error('Secrets list container not found');
      return;
    }

    // Set up event delegation
    this.setupEventListeners();

    // Request initial data
    this.requestData();

    // Listen for messages from extension
    window.addEventListener('message', (event) => this.handleMessage(event));

    console.log('Sidebar initialized');
  }

  /**
   * Set up event listeners with delegation
   */
  private setupEventListeners(): void {
    // Single click handler for all interactions (event delegation)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Scan history button
      if (target.id === 'scanHistoryBtn' || target.closest('#scanHistoryBtn')) {
        this.handleScanHistory();
        e.stopPropagation();
        return;
      }

      // File header toggle
      const fileHeader = target.classList.contains('file-header')
        ? target
        : target.closest('.file-header');

      if (fileHeader && !target.closest('.secret-item')) {
        this.toggleFileGroup(fileHeader as HTMLElement);
        e.stopPropagation();
        return;
      }

      // Secret item click
      const secretItem = target.classList.contains('secret-item')
        ? target
        : target.closest('.secret-item');

      if (secretItem) {
        this.handleSecretClick(secretItem as HTMLElement);
        e.stopPropagation();
        return;
      }
    });

    // Keyboard accessibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target as HTMLElement;
        if (target.classList.contains('file-header') || target.classList.contains('secret-item')) {
          target.click();
          e.preventDefault();
        }
      }
    });
  }

  /**
   * Request data from extension
   */
  private requestData(): void {
    vscode.postMessage({ type: 'ready' });
  }

  /**
   * Handle scan history button click
   */
  private handleScanHistory(): void {
    vscode.postMessage({ type: 'scanHistory' });
  }

  /**
   * Handle secret item click - open file at line
   */
  private handleSecretClick(element: HTMLElement): void {
    const file = element.getAttribute('data-file');
    const line = element.getAttribute('data-line');

    if (file && line) {
      vscode.postMessage({
        type: 'openFile',
        file: file,
        line: parseInt(line, 10)
      });
    }
  }

  /**
   * Toggle file group expansion
   */
  private toggleFileGroup(header: HTMLElement): void {
    const container = header.nextElementSibling as HTMLElement;
    const arrow = header.querySelector('.file-toggle');
    const filePath = header.getAttribute('data-file');

    if (!container || !arrow || !filePath) {
      return;
    }

    const isExpanded = container.classList.contains('expanded');

    // Update selection state
    if (this.selectedFile) {
      const prevSelected = document.querySelector('.file-header.selected');
      prevSelected?.classList.remove('selected');
    }
    header.classList.add('selected');
    this.selectedFile = filePath;

    if (isExpanded) {
      // Collapse
      container.classList.remove('expanded');
      arrow.classList.remove('expanded');
      this.state.expandedFiles.delete(filePath);
    } else {
      // Expand
      container.classList.add('expanded');
      arrow.classList.add('expanded');
      this.state.expandedFiles.add(filePath);
    }

    // Save state
    this.saveState();
  }

  /**
   * Handle messages from extension
   */
  private handleMessage(event: MessageEvent): void {
    const message = event.data;

    switch (message.type) {
      case 'updateSecrets':
        // Cancel any pending render
        if (this.renderRequestId !== null) {
          cancelAnimationFrame(this.renderRequestId);
        }

        // Schedule render using requestAnimationFrame for optimal performance
        this.renderRequestId = requestAnimationFrame(() => {
          this.renderSecrets(message.data, message.timestamp);
          this.renderRequestId = null;
        });
        break;

      case 'error':
        this.showError(message.message);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Render secrets with optimized DOM updates
   */
  private renderSecrets(groupedFindings: GroupedFindings, timestamp: number): void {
    if (!this.container) {
      return;
    }

    // Check if this is a newer update
    if (timestamp < this.state.lastUpdate) {
      console.log('Ignoring stale update');
      return;
    }

    this.state.lastUpdate = timestamp;

    const files = Object.keys(groupedFindings);

    if (files.length === 0) {
      this.showEmptyState();
      return;
    }

    // Use DocumentFragment for efficient batch DOM updates
    const fragment = document.createDocumentFragment();

    for (const file of files) {
      const findings = groupedFindings[file];
      const fileGroup = this.createFileGroup(file, findings);
      fragment.appendChild(fileGroup);
    }

    // Single DOM update
    this.container.innerHTML = '';
    this.container.appendChild(fragment);

    console.log(`Rendered ${files.length} file(s) with secrets`);
  }

  /**
   * Create file group element
   */
  private createFileGroup(filePath: string, findings: Finding[]): HTMLElement {
    const isExpanded = this.state.expandedFiles.has(filePath);
    const fileName = this.getFileName(filePath);
    const secretCount = findings.length;

    // Create file group container
    const fileGroup = document.createElement('div');
    fileGroup.className = 'file-group';

    // Create file header
    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-file', filePath);
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', isExpanded.toString());

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';

    // Toggle chevron (codicon)
    const toggle = document.createElement('span');
    toggle.className = `codicon codicon-chevron-right file-toggle ${isExpanded ? 'expanded' : ''}`;

    // File icon (codicon based on extension)
    const fileIcon = document.createElement('span');
    fileIcon.className = `codicon codicon-${this.getFileIcon(filePath)} file-icon`;

    // File name (no emoji prefix)
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = fileName;
    name.title = filePath;

    fileInfo.appendChild(toggle);
    fileInfo.appendChild(fileIcon);
    fileInfo.appendChild(name);

    const count = document.createElement('span');
    count.className = 'secret-count';
    count.textContent = secretCount.toString();

    header.appendChild(fileInfo);
    header.appendChild(count);

    // Create secrets container
    const container = document.createElement('div');
    container.className = `secrets-container ${isExpanded ? 'expanded' : ''}`;

    // Create secret items
    for (const finding of findings) {
      const item = this.createSecretItem(finding);
      container.appendChild(item);
    }

    fileGroup.appendChild(header);
    fileGroup.appendChild(container);

    return fileGroup;
  }

  /**
   * Create secret item element
   */
  private createSecretItem(finding: Finding): HTMLElement {
    const item = document.createElement('div');
    item.className = 'secret-item';
    item.setAttribute('data-file', finding.file);
    item.setAttribute('data-line', finding.line.toString());
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');

    // Truncate secret for tooltip
    const secretPreview = finding.secret.length > 80
      ? `${finding.secret.substring(0, 80)}...`
      : finding.secret;
    item.title = secretPreview;

    // Secret header (icon + rule + line)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'secret-header';

    // Use codicon instead of emoji
    const icon = document.createElement('span');
    icon.className = 'codicon codicon-key secret-icon';

    const rule = document.createElement('span');
    rule.className = 'secret-rule';
    rule.textContent = finding.ruleID;

    const line = document.createElement('span');
    line.className = 'secret-line';
    line.textContent = `Line ${finding.line}`;

    headerDiv.appendChild(icon);
    headerDiv.appendChild(rule);
    headerDiv.appendChild(line);

    item.appendChild(headerDiv);

    return item;
  }

  /**
   * Show empty state
   */
  private showEmptyState(): void {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = `
      <div class="no-secrets">
        <div class="empty-icon">✓</div>
        <p>No secrets detected</p>
      </div>
    `;
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = `
      <div class="error-message">
        <p>⚠️ ${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Extract file name from path
   */
  private getFileName(filePath: string): string {
    if (!filePath) {
      return 'Unknown';
    }
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  }

  /**
   * Get file extension from path
   */
  private getFileExtension(filePath: string): string {
    const fileName = this.getFileName(filePath);
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Get appropriate VS Code icon for file type
   */
  private getFileIcon(filePath: string): string {
    const ext = this.getFileExtension(filePath);

    // Map extensions to VS Code codicons
    const iconMap: { [key: string]: string } = {
      // JavaScript/TypeScript
      'js': 'symbol-method',
      'ts': 'symbol-method',
      'jsx': 'symbol-method',
      'tsx': 'symbol-method',
      'mjs': 'symbol-method',

      // Configuration
      'json': 'json',
      'yml': 'symbol-property',
      'yaml': 'symbol-property',
      'toml': 'settings-gear',
      'ini': 'settings-gear',
      'conf': 'settings-gear',
      'config': 'settings-gear',

      // Environment/Secrets
      'env': 'lock',

      // Markup/Styles
      'html': 'symbol-color',
      'htm': 'symbol-color',
      'css': 'symbol-color',
      'scss': 'symbol-color',
      'less': 'symbol-color',
      'xml': 'file-code',
      'svg': 'symbol-color',

      // Documentation
      'md': 'markdown',
      'txt': 'file-text',
      'rst': 'file-text',

      // Programming languages
      'py': 'symbol-class',
      'java': 'symbol-class',
      'cpp': 'symbol-class',
      'c': 'symbol-class',
      'cs': 'symbol-class',
      'go': 'symbol-class',
      'rs': 'symbol-class',
      'rb': 'symbol-class',
      'php': 'symbol-class',
      'swift': 'symbol-class',
      'kt': 'symbol-class',

      // Shell
      'sh': 'terminal',
      'bash': 'terminal',
      'zsh': 'terminal',
      'fish': 'terminal',
      'ps1': 'terminal',

      // Data
      'sql': 'database',
      'db': 'database',
      'sqlite': 'database',

      // Docker/Infrastructure
      'dockerfile': 'file-binary',
      'docker-compose': 'file-binary',

      // Git
      'gitignore': 'symbol-file',
      'gitattributes': 'symbol-file'
    };

    return iconMap[ext] || 'file';
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Save state to VS Code
   */
  private saveState(): void {
    vscode.setState({
      expandedFiles: Array.from(this.state.expandedFiles),
      lastUpdate: this.state.lastUpdate
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SidebarController());
} else {
  new SidebarController();
}