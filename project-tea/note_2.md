# Project Update - Architecture Refactoring

**Date**: December 2025

## 🎯 What Changed

### 1. Architecture Transformation

**Before**: Monolithic functions with global state
**After**: Service-based architecture with command isolation and dependency injection

```Text
Old Structure:                    New Structure:
├── extension.ts                 ├── extension.ts (Bootstrap)
├── summary.ts                   ├── commands/
├── services/                    │   └── CommandManager.ts (Command isolation)
│   ├── ServiceContainer.ts      ├── services/
│   ├── GitleaksExecutor.ts      │   ├── ServiceContainer.ts
│   ├── ScanService.ts           │   ├── GitleaksExecutor.ts
│   ├── ScanService.ts           │   ├── ScanService.ts
│   ├── NavigationService.ts     │   ├── NavigationService.ts
│   ├── Logger.ts                │   ├── Logger.ts
│   ├── ErrorHandler.ts          │   ├── ErrorHandler.ts
│   └── interfaces.ts            │   └── interfaces.ts
├── stores/                      ├── stores/
│   └── FindingsStore.ts         │   └── FindingsStore.ts
├── ui/                          ├── ui/
│   ├── DiagnosticsUI.ts         │   ├── DiagnosticsUI.ts
│   ├── StatusBarUI.ts           │   ├── StatusBarUI.ts
│   └── SidebarProvider.ts       │   ├── SidebarProvider.ts
│                                │   └── SummaryPanel.ts (Moved from src/summary.ts)
├── webview/                     ├── webview/
│   └── sidebar.ts               │   └── sidebar.ts
├── parsers/                     ├── parsers/
│   └── GitleaksOutputParser.ts  │   └── GitleaksOutputParser.ts
└── errors/                      └── errors/
    ├── CustomErrors.ts              ├── CustomErrors.ts
    └── SidebarErrors.ts             └── SidebarErrors.ts
```

## 🏗️ Architecture Overview

The extension follows a **service-based architecture** with these key principles:

### Core Principles

1. **Dependency Injection**: Services receive dependencies through constructors
2. **Single Responsibility**: Each service has one clear purpose
3. **Command Manager**: Decouples command registration and logic from the entry point
4. **Interface Segregation**: Clear contracts between components
5. **Separation of Concerns**: UI, business logic, and data are separated
6. **Observable State**: Reactive updates via observer pattern

### Architecture Layers

```Text
┌─────────────────────────────────────────────┐
│           Extension Entry Point             │
│              (extension.ts)                 │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│          Service Container Layer            │
│           (ServiceContainer.ts)             │
│  • Creates services                         │
│  • Manages dependencies                     │
│  • Provides singleton access                │
└─────────────────────────────────────────────┘
                     │
         ┌───────────┼────────────┐
         │           │            │
         ▼           ▼            ▼
┌─────────────┐ ┌─────────┐ ┌────────────┐
│   Services  │ │  Stores │ │   UI       │
│   Layer     │ │  Layer  │ │   Layer    │
│             │ │         │ │            │
│ • Executor  │ │ • Store │ │ • Diag UI  │
│ • Scanner   │ │         │ │ • Status   │
│ • Logger    │ │         │ │   Bar      │
│ • Error     │ │         │ │ • Sidebar  │
│             │ │         │ │ • Summary  │
└─────────────┘ └─────────┘ └────────────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│              Support Layer                  │
│  • Command Manager                          │
│  • Parsers                                  │
│  • Error Types                              │
│  • Interfaces                               │
└─────────────────────────────────────────────┘
```

---

## 📁 Code Structure

### Directory Layout

```Text
src/
├── extension.ts              # Entry point - activation & deactivation
│
├── commands/                 # Command isolation layer
│   └── CommandManager.ts     # Command registrations and handlers
│
├── services/                 # Business logic services
│   ├── interfaces.ts         # ⭐ ALL interfaces and types
│   ├── ServiceContainer.ts   # Dependency injection container
│   ├── GitleaksExecutor.ts   # Binary execution
│   ├── ScanService.ts        # Scan orchestration
│   ├── Logger.ts             # Logging service
│   └── ErrorHandler.ts       # Error handling
│
├── stores/                   # State management
│   └── FindingsStore.ts      # Central state with observer pattern
│
├── ui/                       # UI components
│   ├── DiagnosticsUI.ts      # Code diagnostics & decorations
│   ├── StatusBarUI.ts        # Status bar management
│   ├── SidebarProvider.ts    # Sidebar webview provider
│   └── SummaryPanel.ts       # Secrets summary webview panel
│
├── webview/                  # Webview client-side code
│   └── sidebar.ts            # Sidebar webview UI logic
│
├── parsers/                  # Data parsers
│   └── GitleaksOutputParser.ts  # Parse Gitleaks output
│
├── errors/                   # Custom error types
│   ├── CustomErrors.ts       # Error hierarchy
│   └── SidebarErrors.ts      # Sidebar-specific errors
│
├── templates/                # HTML templates
│   ├── summary-empty.html    # Empty state template
│   └── summary-table.html    # Findings table template
│
└── services/                 # Template rendering
    └── TemplateEngine.ts     # Template engine with XSS protection
```


### 2. Interface Consolidation

All interfaces are now centralized in [`src/services/interfaces.ts`](src/services/interfaces.ts:1):

**Data Models:**

- `WorkspaceFinding` - Secrets found in workspace/files (replaces `scanSummaryResultValue`)
- `HistoryFinding` - Secrets found in git history (replaces `scanHistoryResultValue`)

**Service Interfaces:**

- `IGitleaksExecutor` - Execute Gitleaks binary
- `IOutputParser` - Parse Gitleaks output
- `IDiagnosticsUI` - Manage VS Code diagnostics
- `IStatusBarUI` - Manage status bar
- `ILogger` - Logging service
- `INavigationService` - File navigation service
- `ISidebarUI` - Sidebar webview provider

**Supporting Types:**

- `ScanOptions` - Configuration for scans
- `ScanResult` - Scan results wrapper
- `LogLevel` - Logging levels enum
- `WebviewProtocol` - Type-safe message protocol for webview communication
- `GroupedFindings` - Findings grouped by file for sidebar display

### 3. State Management

**Before**: Global mutable variables

```typescript
// ❌ Old way - global state
export let FindingsSummary: Set<scanSummaryResultValue> = new Set();
export let FindingsHistory: Set<scanHistoryResultValue> = new Set();
```

**After**: Centralized store with observer pattern

```typescript
// ✅ New way - encapsulated state
const findingsStore = new FindingsStore();
findingsStore.subscribe((event) => {
  // React to state changes
});
```

### 4. Error Handling

**Before**: Generic error messages
**After**: Structured error hierarchy

```typescript
// New error types in src/errors/CustomErrors.ts
- GitleaksNotFoundError
- GitleaksExecutionError
- InvalidOutputError
- FileAccessError
- WorkspaceNotFoundError
- ScanTimeoutError
- ConfigurationError
```

### 5. Dependency Injection

**Before**: Hard-coded dependencies

```typescript
// ❌ Old way
function scanFile(filePath: string) {
  const output = executeGitleaks(filePath); // Hard-coded
  const findings = parseOutput(output);     // Hard-coded
  updateUI(findings);                       // Hard-coded
}
```

**After**: Services injected via container

```typescript
// ✅ New way
class ScanService {
  constructor(
    private executor: IGitleaksExecutor,
    private parser: IOutputParser,
    private findingsStore: FindingsStore,
    private diagnosticsUI: IDiagnosticsUI,
    private logger: ILogger
  ) {}

  async scanFile(filePath: string): Promise<WorkspaceFinding[]> {
    // All dependencies injected, easy to test
  }
}
```

---

## 📁 New Code Structure

### Core Services (`src/services/`)

**ServiceContainer.ts** - Central dependency injection container

- Creates and manages all service instances
- Provides singleton access to services
- Handles service lifecycle

**GitleaksExecutor.ts** - Binary execution service

- Executes Gitleaks scans (file, workspace, history)
- Handles platform-specific binary paths
- Manages command-line arguments

**ScanService.ts** - Scan orchestration

- Coordinates scanning workflow
- Manages state updates
- Handles UI updates

**Logger.ts** - Logging service

- Structured logging with levels (debug, info, warn, error)
- Output channel management
- Timestamp formatting

**ErrorHandler.ts** - Error handling service

- Classifies errors by type
- Provides user-friendly messages
- Logs errors appropriately

**NavigationService.ts** - File navigation service

- Handles file opening from sidebar/UI
- Path resolution (absolute, relative, URI formats)
- File validation before opening
- Integration with VS Code editor

### State Management (`src/stores/`)

**FindingsStore.ts** - Centralized state container

- Stores workspace findings (by file)
- Stores history findings
- Observer pattern for reactive updates
- Type-safe event system

```typescript
// Subscribe to findings changes
findingsStore.subscribe((event) => {
  switch (event.type) {
    case 'workspace':
      // New workspace finding added
      break;
    case 'history':
      // New history finding added
      break;
    case 'workspace-cleared':
      // Workspace findings cleared
      break;
    case 'history-cleared':
      // History findings cleared
      break;
  }
});
```

### UI Services (`src/ui/`)

**DiagnosticsUI.ts** - VS Code diagnostics management

- Creates error markers in code
- Manages decorations (highlights)
- Per-file decoration tracking

**StatusBarUI.ts** - Status bar management

- Shows findings count
- Reactive updates via FindingsStore
- Error/warning states

**SidebarProvider.ts** - Sidebar webview provider

- Implements VS Code WebviewViewProvider interface
- Groups findings by file for hierarchical display
- Handles bidirectional messaging with webview
- Subscribes to FindingsStore for automatic updates
- Uses NavigationService for file navigation
- Manages webview lifecycle and state restoration

### Parsers (`src/parsers/`)

**GitleaksOutputParser.ts** - Output parsing

- Parses Gitleaks text output
- Converts to structured findings
- Handles workspace and history formats

### Error System (`src/errors/`)

**CustomErrors.ts** - Custom error types

- 7 specific error classes for scanning operations
- Structured error information
- Better error handling and debugging

**SidebarErrors.ts** - Sidebar-specific error types

- `SidebarError` - Base class with cause tracking
- `WebviewCommunicationError` - Webview messaging failures
- `FileNavigationError` - File opening issues
- `FileNotFoundError` - Missing file errors
- `WorkspaceNotFoundError` - Missing workspace errors
- `StateRestorationError` - State persistence failures

---

## 🔄 Migration Guide

### For Developers

#### 1. Import Changes

**Old Imports:**

```typescript
import { scanSummaryResultValue, scanHistoryResultValue } from './interface';
import { FindingsSummary, FindingsHistory } from './utils/gitleaks';
import { UpdateStatusBar } from './statusBar';
```

**New Imports:**

```typescript
import { WorkspaceFinding, HistoryFinding } from './services/interfaces';
import { FindingsStore } from './stores/FindingsStore';
import { StatusBarUI } from './ui/StatusBarUI';
```

#### 2. Type Name Changes

| Old Name | New Name | Type |
|----------|----------|------|
| `scanSummaryResultValue` | `WorkspaceFinding` | Interface |
| `scanHistoryResultValue` | `HistoryFinding` | Interface |

#### 3. State Access Changes

**Old Way:**

```typescript
// ❌ Direct global access
const count = FindingsSummary.size;
FindingsSummary.add(finding);
```

**New Way:**

```typescript
// ✅ Via FindingsStore
const count = findingsStore.getWorkspaceFindingsCount();
findingsStore.addWorkspaceFinding(filePath, finding);
```

#### 4. Service Access

**Old Way:**

```typescript
// ❌ Direct function calls
await RunScanSingleFile(filePath);
UpdateStatusBar();
```

**New Way:**

```typescript
// ✅ Via ServiceContainer
const container = ServiceContainer.getInstance();
await container.scanService.scanFile(filePath);
// StatusBar updates automatically via FindingsStore subscription
```

---

## 🎨 Design Patterns Used

### 1. Dependency Injection

Services receive dependencies through constructor, making testing easier.

### 2. Observer Pattern

FindingsStore notifies subscribers of state changes for reactive UI updates.

### 3. Singleton Pattern

ServiceContainer ensures single instance of services across extension.

### 4. Factory Pattern

ServiceContainer acts as factory for creating configured services.

### 5. Strategy Pattern

Different scan strategies (file, workspace, history) handled by same interface.

---

## 🧪 Testing Improvements

### Before

- Hard to test due to global state
- Tightly coupled dependencies
- No mocking support

### After

- Easy to test with dependency injection
- Mock interfaces for unit tests
- Isolated component testing

**Example Test:**

```typescript
// Mock dependencies
const mockExecutor: IGitleaksExecutor = {
  executeSingleFile: jest.fn().mockResolvedValue('mock output')
};
const mockParser: IOutputParser = {
  parseWorkspaceScan: jest.fn().mockReturnValue([mockFinding])
};

// Test with mocks
const scanService = new ScanService(
  mockExecutor,
  mockParser,
  mockStore,
  mockDiagnostics,
  mockLogger
);
```

---

## 📝 Breaking Changes

### Removed Files

The following files have been **deleted** (functionality moved to new services):

- ❌ `src/interface.ts` → Now in `src/services/interfaces.ts`
- ❌ `src/utils/gitleaks.ts` → Split into `GitleaksExecutor`, `ScanService`, `GitleaksOutputParser`
- ❌ `src/statusBar.ts` → Now `src/ui/StatusBarUI.ts`
- ❌ `src/diagnostics.ts` → Now `src/ui/DiagnosticsUI.ts`

### Changed APIs

- Global state variables removed
- Direct function calls replaced with service methods
- Interface names updated for clarity

---

## 📚 Resources

### Key Files to Understand

1. **Entry Point**: [`src/extension.ts`](src/extension.ts:1)
   - Extension activation
   - Service initialization
   - Command registration

2. **Service Container**: [`src/services/ServiceContainer.ts`](src/services/ServiceContainer.ts:1)
   - Central dependency management
   - Service creation and access

3. **Interfaces**: [`src/services/interfaces.ts`](src/services/interfaces.ts:1)
   - All type definitions
   - Service contracts

4. **State Management**: [`src/stores/FindingsStore.ts`](src/stores/FindingsStore.ts:1)
   - Central state storage
   - Event system

---

## 🔄 Scan on Save Mechanism

### Old Architecture (Monolithic)

#### Flow Diagram

```Text
User saves file
       ↓
extension.ts: onDidSaveTextDocument
       ↓
RunScanCurrentDir(workspacePath)  ← ❌ Scans ENTIRE workspace!
       ↓
exec("gitleaks detect --source /workspace")  ← ❌ Includes git operations
       ↓
Wait 500-5000ms  ← ❌ Very slow
       ↓
parseAndHighlightFindings(stdout)
       ↓
Directly mutate: FindingsSummary.add()  ← ❌ Global state
       ↓
Directly mutate: DiagnosticsMap.set()  ← ❌ Global state
       ↓
Call UpdateStatusBar()  ← ❌ Manual UI update
       ↓
Done (but slow and inefficient)
```

### Updated Architecture

#### Document Save Flow (Primary Scan Mechanism)

```Text
User saves file
       ↓
extension.ts: onDidSaveTextDocument
       ↓
handleDocumentSave()  ← ✅ Smart filtering
       ↓
Check: Skip git/output/debug schemes?  ← ✅ Skip special files
       ↓
Check: Is untitled?  ← ✅ Skip unsaved files
       ↓
Check: File in workspace?  ← ✅ Skip external files
       ↓
scanService.scanFile(filePath)  ← ✅ Scan ONLY saved file!
       ↓
executor.executeSingleFile(filePath)
       ↓
exec("gitleaks detect --source file.js --no-git")  ← ✅ No git operations!
       ↓
Wait 50-200ms  ← ✅ 10-100x faster!
       ↓
parser.parseWorkspaceScan(output)  ← ✅ Structured parsing
       ↓
findingsStore.addWorkspaceFindings()  ← ✅ Encapsulated state
       ↓
Store emits event  ← ✅ Observer pattern
       ↓
╔═══════════════════════════════════╗
║  All subscribers auto-notified!   ║
╠═══════════════════════════════════╣
║  → StatusBarUI updates            ║
║  → DiagnosticsUI updates          ║
║  → Any other subscribers          ║
╚═══════════════════════════════════╝
       ↓
Done (fast and automatic!)
```

---

## 📊 Sidebar Feature - Architectural Refactoring

### Overview

The sidebar feature provides a hierarchical view of all detected secrets, grouped by file. The implementation underwent comprehensive architectural refactoring to align with established design principles and best practices.

### Before Refactoring (Initial Implementation)

**Structure:**

- Single monolithic `SidebarProvider.ts` with mixed concerns
- Business logic embedded in UI layer
- Direct VS Code API calls
- Generic error handling
- Type casts breaking type safety
- Duplicate interface definitions

**Issues:**

- 60+ lines of file navigation logic in UI component
- Hard-coded dependencies
- No separation between business logic and presentation
- Missing custom error types for better error handling
- Type safety compromised with `as any` casts

### After Refactoring (Current Architecture)

**Architecture Layers:**

```text
┌─────────────────────────────────────┐
│     Sidebar Webview (Client)        │
│      (src/webview/sidebar.ts)       │
│  • DOM manipulation                 │
│  • Event delegation                 │
│  • Debounced search                 │
│  • Performance optimizations        │
└─────────────────────────────────────┘
              ↕ WebviewProtocol (Type-safe messages)
┌─────────────────────────────────────┐
│   SidebarProvider (UI Orchestrator) │
│    (src/ui/SidebarProvider.ts)      │
│  • Webview lifecycle                │
│  • Message handling                 │
│  • State restoration                │
│  • Delegates to services            │
└─────────────────────────────────────┘
         ↓                    ↓
┌──────────────────┐  ┌──────────────────┐
│ NavigationService│  │  ErrorHandler    │
│  • File opening  │  │  • Error msgs    │
│  • Path resolve  │  │  • Logging       │
│  • Validation    │  │  • User feedback │
└──────────────────┘  └──────────────────┘
```

### Key Architectural Improvements

#### 1. **Type-Safe Communication Protocol**

**Before:**
```typescript
// Scattered message types across files
interface MessageData {
  command: string;
  filePath?: string;
}
```

**After:**
```typescript
// Centralized in services/interfaces.ts
namespace WebviewProtocol {
  export type ToExtension =
    | { command: 'openFile'; filePath: string; line: number; }
    | { command: 'refresh'; }
    | { command: 'ready'; };

  export type ToWebview =
    | { command: 'updateFindings'; findings: GroupedFindings; }
    | { command: 'error'; message: string; };
}
```

#### 2. **NavigationService Extraction**

**Business Logic Separation:**

- Extracted 60+ lines of file navigation logic from `SidebarProvider`
- Handles path resolution (absolute, relative, `file://` URIs)
- Validates file existence before opening
- Provides clean interface for file operations

**Service Interface:**
```typescript
interface INavigationService {
  openFile(filePath: string, line?: number): Promise<void>;
}
```

**Benefits:**

- UI layer focuses on presentation
- Business logic is testable in isolation
- Reusable across different UI components
- Clear separation of concerns

#### 3. **Custom Error Hierarchy**

**Before:**
```typescript
throw new Error('Failed to open file');
```

**After:**
```typescript
// Specialized error types in errors/SidebarErrors.ts
class FileNavigationError extends SidebarError {
  constructor(filePath: string, cause?: Error) {
    super(`Failed to navigate to file: ${filePath}`, cause);
  }
}

class FileNotFoundError extends FileNavigationError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.recoverable = false;
  }
}
```

**Error Types:**
- `SidebarError` - Base with cause tracking and recoverability
- `WebviewCommunicationError` - Messaging failures
- `FileNavigationError` - File opening issues
- `FileNotFoundError` - Missing files
- `WorkspaceNotFoundError` - Missing workspace
- `StateRestorationError` - State persistence

#### 4. **Command-Based Architecture**

**Integration with VS Code Commands:**

```typescript
// package.json
{
  "commands": [{
    "command": "project-tea.sidebar.refresh",
    "title": "Refresh Sidebar",
    "category": "Secret Tea",
    "icon": "$(refresh)"
  }]
}

// extension.ts
vscode.commands.registerCommand(
  'project-tea.sidebar.refresh',
  () => sidebarProvider.refresh()
);
```

**Benefits:**

- Accessible from command palette
- Keyboard shortcut support
- Consistent with VS Code patterns
- Testable command handlers

#### 5. **Dependency Injection**

**Before:**
```typescript
class SidebarProvider {
  constructor() {
    // Hard-coded dependencies
  }

  private async openFile(path: string) {
    // Direct VS Code API calls
    await vscode.window.showTextDocument(/*...*/);
  }
}
```

**After:**
```typescript
class SidebarProvider {
  constructor(
    private context: vscode.ExtensionContext,
    private findingsStore: FindingsStore,
    private navigationService: INavigationService,
    private errorHandler: ErrorHandler,
    private logger: ILogger
  ) {}

  private async handleOpenFile(filePath: string, line: number) {
    // Delegate to service
    await this.navigationService.openFile(filePath, line);
  }
}
```

#### 6. **Observer Pattern Integration**

**Automatic UI Updates:**
```typescript
// SidebarProvider subscribes to FindingsStore
this.findingsStore.subscribe((event) => {
  if (event.type === 'workspace' || event.type === 'workspace-cleared') {
    this.updateWebview();
  }
});
```

**Flow:**
```text
Scan completes
    ↓
FindingsStore updated
    ↓
Event emitted
    ↓
SidebarProvider notified
    ↓
Webview automatically refreshed
```

### Performance Optimizations

**Client-Side (Webview):**
1. **Debounced Search** - 300ms delay prevents excessive filtering
2. **Event Delegation** - Single listener for all file clicks
3. **Batch DOM Updates** - Minimize reflows
4. **Efficient Rendering** - Only update changed elements

**Extension Host:**
1. **Lazy Webview Creation** - Only create when sidebar is visible
2. **State Restoration** - Restore view state after reload
3. **Efficient Grouping** - Pre-group findings before sending to webview
4. **Proper Disposal** - Clean up resources on deactivation

### File Structure

```text
src/
├── ui/
│   └── SidebarProvider.ts          # Webview provider (orchestration)
├── webview/
│   └── sidebar.ts                  # Client-side UI logic
├── services/
│   ├── NavigationService.ts        # File navigation business logic
│   └── interfaces.ts               # WebviewProtocol, GroupedFindings
├── errors/
│   └── SidebarErrors.ts           # Custom error hierarchy
└── extension.ts                    # Command registration
```

### Integration Points

**ServiceContainer Registration:**
```typescript
// Step 6: NavigationService (before SidebarProvider)
const navigationService = new NavigationService(logger);

// Step 7: ErrorHandler (before SidebarProvider)
const errorHandler = new ErrorHandler(logger);

// Step 8: SidebarProvider (with all dependencies)
const sidebarProvider = new SidebarProvider(
  context,
  findingsStore,
  navigationService,
  errorHandler,
  logger
);
```

### Design Patterns Applied

1. **Dependency Injection** - Services injected via constructor
2. **Observer Pattern** - FindingsStore → SidebarProvider updates
3. **Strategy Pattern** - NavigationService handles different path types
4. **Factory Pattern** - ServiceContainer creates configured services
5. **Command Pattern** - VS Code commands for sidebar actions

### Testing Benefits

**Before:**
- Hard to test due to mixed concerns
- Direct VS Code API calls can't be mocked
- No isolation between components

**After:**
- Services can be unit tested in isolation
- Mock `INavigationService` for UI tests
- Mock `FindingsStore` for integration tests
- Clear interfaces enable comprehensive testing

### Migration from Initial Implementation

**Phase 1: Type Safety**
- ✅ Centralized message protocol types
- ✅ Removed type casts (`as any`)
- ✅ Added `GroupedFindings` interface

**Phase 2: Service Extraction**
- ✅ Created `NavigationService`
- ✅ Extracted file opening logic
- ✅ Updated `SidebarProvider` to delegate

**Phase 3: Command Architecture**
- ✅ Added `project-tea.sidebar.refresh` command
- ✅ Registered in `package.json`
- ✅ Implemented command handler

**Phase 4: Error Handling**
- ✅ Created custom error hierarchy
- ✅ Updated services to throw typed errors
- ✅ Integrated `ErrorHandler` service

### Reference Implementation

The refactored sidebar serves as a **reference implementation** for future webview components, demonstrating:

- Proper separation of concerns
- Type-safe extension ↔ webview communication
- Service-based architecture
- Custom error handling
- Command integration
- Observer pattern for reactive updates
- Performance optimizations
- Resource cleanup patterns

---

## 🤝 Need Help?

### Common Questions

**Q: Where do I add a new scan type?**
A: Add method to `IGitleaksExecutor` interface and implement in `GitleaksExecutor.ts`

**Q: How do I add a new UI component?**
A: Create new service in `src/ui/`, implement interface in `src/services/interfaces.ts`

**Q: Where do I add new error types?**
A: Add to `src/errors/CustomErrors.ts` and update `ErrorHandler.ts`

**Q: How do I access services in commands?**
A: Use `ServiceContainer.getInstance()` to get service instances
