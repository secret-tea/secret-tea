# Developer Guide & Contribution

Welcome! This guide helps you understand the architecture, goals, and internal mechanisms of **Secret Tea**.

## 🎯 Project Goal
The goal of Secret Tea is to provide a **lightweight, real-time secret scanner** for VS Code. It wraps the powerful `gitleaks` engine to detect sensitive data (API keys, tokens) without the overhead of heavy configuration.

### Core Use Cases
- **On-Save Scan**: Scan only the modified file immediately upon saving (10-100x faster than workspace scans).
- **History Scan**: Deep scan of Git commit history via manual command.
- **Sidebar Integration**: Navigate findings hierarchically by file.
- **Problem Reporting**: Findings appear in the editor and Problems panel.

### On going taks
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
│   ├── ScanService.ts        # Orchestrates the scanning flow
│   ├── GitleaksExecutor.ts   # Binary execution & OS handling
│   └── interfaces.ts         # Central contracts & types
├── stores/                   # State management
│   └── FindingsStore.ts      # Reactive finding storage
├── ui/                       # VS Code UI Components
│   ├── SidebarProvider.ts    # Sidebar Webview lifecycle
│   ├── SummaryPanel.ts       # HTML report panel
│   └── DiagnosticsUI.ts      # Editor decorations & Problems markers
├── webview/                  # Client-side UI code for Webviews
└── templates/                # HTML templates for rendering reports
```

---

### Key Principles
1.  **Dependency Injection**: Services receive dependencies through constructors, managed by a central `ServiceContainer`.
2.  **Observable State**: The `FindingsStore` is the single source of truth; UI components subscribe to it for reactive updates.
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

## ⚙️ How It Works (Under the Hood)

### 1. The Scan Pipeline
When a scan is triggered (Save/Command):
1.  **Orchestration**: `ScanService` calls `GitleaksExecutor`.
2.  **Execution**: `GitleaksExecutor` identifies the OS, locates the bundled binary, and executes a targeted `detect` command.
3.  **Parsing**: `GitleaksOutputParser` converts raw stdout into structured `WorkspaceFinding` models.
4.  **Reaction**: `FindingsStore` is updated. It emits an event to all subscribers (Diagnostics, Status Bar, Sidebar), which update themselves automatically.

### 2. Optimized "Scan on Save"
Unlike full workspace scans, the save trigger calls a specific "single-file" execution. This prevents UI lag and ensures immediate developer feedback.

### 3. State Restoration
The sidebar uses a Webview that can be disposed by VS Code to save memory. We handle state restoration to ensure findings persist when the developer re-opens the view.

---

## 🚀 Getting Started
1.  **Build**: `pnpm run watch` (Compiles both Extension and Webview).
2.  **Run**: Press `F5` in VS Code to start the Extension Development Host.
3.  **Test**: `pnpm test` (Uses Jest for unit testing logic).
