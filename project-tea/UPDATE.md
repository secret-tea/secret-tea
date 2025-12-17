# Project Update - Architecture Refactoring

**Date**: December 2025

## 🎯 What Changed

### 1. Architecture Transformation

**Before**: Monolithic functions with global state
**After**: Service-based architecture with dependency injection

```Text
Old Structure:                    New Structure:
├── extension.ts                 ├── extension.ts (entry point)
├── commands.ts                  ├── services/
├── utils/gitleaks.ts            │   ├── ServiceContainer.ts
├── statusBar.ts                 │   ├── GitleaksExecutor.ts
├── diagnostics.ts               │   ├── ScanService.ts
└── interface.ts                 │   ├── Logger.ts
                                 │   ├── ErrorHandler.ts
                                 │   └── interfaces.ts
                                 ├── stores/
                                 │   └── FindingsStore.ts
                                 ├── ui/
                                 │   ├── DiagnosticsUI.ts
                                 │   └── StatusBarUI.ts
                                 ├── parsers/
                                 │   └── GitleaksOutputParser.ts
                                 └── errors/
                                     └── CustomErrors.ts
```

## 🏗️ Architecture Overview

The extension follows a **service-based architecture** with these key principles:

### Core Principles

1. **Dependency Injection**: Services receive dependencies through constructors
2. **Single Responsibility**: Each service has one clear purpose
3. **Interface Segregation**: Clear contracts between components
4. **Separation of Concerns**: UI, business logic, and data are separated
5. **Observable State**: Reactive updates via observer pattern

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
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌─────────────┐ ┌─────────┐ ┌────────────┐
│   Services  │ │  Stores │ │   UI       │
│   Layer     │ │  Layer  │ │   Layer    │
│             │ │         │ │            │
│ • Executor  │ │ • Store │ │ • Diag UI  │
│ • Scanner   │ │         │ │ • Status   │
│ • Logger    │ │         │ │   Bar      │
│ • Error     │ │         │ │            │
└─────────────┘ └─────────┘ └────────────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│              Support Layer                  │
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
├── commands.ts               # Command registrations
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
│   └── StatusBarUI.ts        # Status bar management
│
├── parsers/                  # Data parsers
│   └── GitleaksOutputParser.ts  # Parse Gitleaks output
│
├── errors/                   # Custom error types
│   └── CustomErrors.ts       # Error hierarchy
│
├── templates/                # HTML templates
│   ├── summary-empty.html    # Empty state template
│   └── summary-table.html    # Findings table template
│
├── services/                 # Template rendering
│   └── TemplateEngine.ts     # Template engine with XSS protection
│
└── __tests__/                # Test files (mirror src structure)
    ├── services/
    ├── stores/
    └── ui/
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

**Supporting Types:**

- `ScanOptions` - Configuration for scans
- `ScanResult` - Scan results wrapper
- `LogLevel` - Logging levels enum

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

### Parsers (`src/parsers/`)

**GitleaksOutputParser.ts** - Output parsing

- Parses Gitleaks text output
- Converts to structured findings
- Handles workspace and history formats

### Error System (`src/errors/`)

**CustomErrors.ts** - Custom error types

- 7 specific error classes
- Structured error information
- Better error handling and debugging

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
