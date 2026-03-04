# Secret Tea

Secret Tea is a lightweight VS Code extension designed to protect your project from accidental secret leaks. It provides real-time detection of sensitive information like API keys, tokens, and hardcoded credentials directly within your development workflow.

## 🌟 What it Does

- **Real-time Protection**: Automatically scans files as you save them, providing instant feedback without slowing down your computer.
- **Comprehensive Scanning**: Perform deep scans of your entire workspace or your complete Git commit history to find legacy secrets.
- **Seamless Integration**: Findings appear in the Problems panel, as editor decorations (highlights), and in a dedicated sidebar for easy exploration.
- **Insights & Reports**: Generates detailed summary reports of all detected secrets.

## ⚙️ How it Works

This extension is a lightweight wrapper around the `gitleaks` binary. It executes the `gitleaks detect` command against your current workspace and surfaces the findings directly within the VS Code UI, making it easy to identify and remediate potential security risks.
