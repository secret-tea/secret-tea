# Developer Guide & Contribution

Welcome! This guide helps you understand the architecture, goals, and internal mechanisms of **Secret Tea**.

## 🎯 Goal
The goal of Secret Tea is to provide a **lightweight, real-time scanner** for VSCode protecting users from exposing hard-coded sensitive data (API keys, credentials) and detect malicious npm packages.

### Use Cases
- **On-save secret scan**: realtime scan on changing file
- **Commit history scan**: Deep scan on project's git commit history.
- **Malware npm package scan**: Detect malicious npm packages (only support `package-lock.json` for now).
- **Reporting**: Findings group by file with easy navigating.

### On going issues
* issues: https://git.thuanle.me/lvtn/lvtn-251-project-tea/issues
---

## 🏗️ Architecture & Patterns
Secret Tea follows a **Service-Oriented Architecture** built on **Dependency Injection** and the **Observer Pattern**.

## 📁 Directory Layout
```Text
src/
├── extension.ts              # Extension lifecycle & bootstrap
├── commands/                 # Command registration & handlers
│   └── CommandManager.ts     # Centralized command logic
├── services/                 # Core business services
│   ├── ServiceContainer.ts   # DI Container
│   ├── ScanService.ts        # Orchestrates secret scanning flow
│   ├── GitleaksExecutor.ts   # Binary execution & OS handling
│   ├── MalwareScannerService.ts  # NPM malware detection
│   ├── NavigationService.ts  # File navigation helpers
│   ├── Logger.ts             # Logging service
│   ├── ErrorHandler.ts       # Error handling
│   └── interfaces.ts         # Central contracts & types
├── stores/                   # State management
│   ├── FindingsStore.ts      # Reactive secret finding storage
│   └── MalwareStore.ts      # Reactive malware vulnerability storage
├── ui/                       # VS Code UI Components
│   ├── SidebarProvider.ts    # Secrets sidebar Webview lifecycle
│   ├── MalwareSidebarProvider.ts  # Malware sidebar Webview lifecycle
│   ├── SummaryPanel.ts       # HTML report panel
│   ├── StatusBarUI.ts        # Status bar indicators
│   └── DiagnosticsUI.ts      # Editor decorations & Problems markers
├── webview/                  # Client-side UI code for Webviews
│   ├── malware.ts            # Malware sidebar client logic
│   └── sidebar.ts            # Secrets sidebar client logic
├── templates/                # HTML templates for rendering reports
├── parsers/                  # Output parsers
│   └── GitleaksOutputParser.ts
├── errors/                   # Custom error types
├── core/                     # Core infrastructure
│   ├── ServiceContainer.ts   # DI container
│   └── ServiceRegistry.ts    # Service registration
└── services/                 # Additional services

executables/                  # Bundled executables & data
├── gitleaks_*                # Platform-specific gitleaks binaries
└── malware_predictions.json # Malware database
```

---

### Key Principles
1.  **Dependency Injection**: Services receive dependencies through constructors, managed by a central `ServiceContainer`.
2.  **Observable State**: The `FindingsStore` and `MalwareStore` are the single sources of truth; UI components subscribe to them for reactive updates.
3.  **Command Isolation**: `CommandManager` decouples VS Code command registration from the extension lifecycle.
4.  **Layered Responsibility**: Clear separation between Business Logic (Services), State (Stores), and Presentation (UI/Webview).

### System Components
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
          ┌───────────┼────────────┐
          │           │            │
          ▼           ▼            ▼
┌─────────────┐ ┌───────-──┐ ┌────────────┐
│   Services  │ │  Stores  │ │   UI       │
│   Layer     │ │  Layer   │ │   Layer    │
│             │ │          │ │            │
│ • Executor  │ │ • Store  │ │ • Diag UI  │
│ • Scanner   │ │ • Malware│ │ • Status   │
│ • Logger    │ │   Store  │ │   Bar      │
│ • Error     │ │          │ │ • Sidebar  │
│ • Malware   │ │          │ │ • Malware  │
│   Scanner   │ │          │ │   Sidebar  │
│             │ │          │ │ • Summary  │
└─────────────┘ └─────────-┘ └────────────┘
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

## ⚙️ How It Works (Under the Hood)

### 1. Secret Scan Pipeline
When a scan is triggered (Save/Command):
1.  **Orchestration**: `ScanService` calls `GitleaksExecutor`.
2.  **Execution**: `GitleaksExecutor` identifies the OS, locates the bundled binary, and executes a targeted `detect` command.
3.  **Parsing**: `GitleaksOutputParser` converts raw stdout into structured `WorkspaceFinding` models.
4.  **Reaction**: `FindingsStore` is updated. It emits an event to all subscribers (Diagnostics, Status Bar, Sidebar), which update themselves automatically.

### 2. Malware Scan Pipeline
When malware scan is triggered (Command/Sidebar button):
1.  **Service**: `MalwareScannerService` loads the malware database from `malware_predictions.json`.
2.  **Scanning**: Reads and parses `package-lock.json` from the workspace.
3.  **Detection**: Compares each package against the database using exact `package_name@version` matching.
4.  **Storage**: `MalwareStore` is updated with found vulnerabilities.
5.  **Reaction**: `MalwareSidebarProvider` receives the update and refreshes the webview to display findings.

### 3. Optimized "Scan on Save"
Unlike full workspace scans, the save trigger calls a specific "single-file" execution. This prevents UI lag and ensures immediate developer feedback.

### 4. State Restoration
The sidebar uses a Webviews that can be disposed by VS Code to save memory. We handle state restoration to ensure findings persist when the developer re-opens the view.

---

## 🚀 Getting Started
1.  **Build**: `pnpm run watch` (Compiles both Extension and Webview).
2.  **Run**: Press `F5` in VS Code to start the Extension Development Host.
3.  **Test**: `pnpm test` (Uses Jest for unit testing logic).
