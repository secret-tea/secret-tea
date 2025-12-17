# Secret Scanner

This extension helps prevent committing secrets like API keys and passwords into your source control. It integrates the powerful `gitleaks` tool to scan your workspace for hardcoded credentials.

## Usage

* The current workspace will be scan automatically on saving.

* To scan for all commit history:
  * Open the Command Palette (`Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on macOS).
  * Type and select `Scan secrets: Scan git commit history`.

## How It Works

This extension is a lightweight wrapper around the `gitleaks` binary. It executes the `gitleaks detect` command against your current workspace and surfaces the findings directly within the VS Code UI, making it easy to identify and remediate potential security risks.

## Features

* Scan the current workspace for secrets.
* Scan the the entire project's git history for secrets.
