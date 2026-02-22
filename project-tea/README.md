# Secret Scanner

This extension helps prevent committing secrets like API keys and passwords into your Git project. It integrates the powerful `gitleaks` tool to scan your workspace for hardcoded credentials. It was created aiming to protect developer from secret leaking without the hassel of setting up too many things.

## Usage

* The current workspace will be scan automatically on saving.
* To scan for all commit history, use scan button on Side panel

## How It Works

This extension is a lightweight wrapper around the `gitleaks` binary. It executes the `gitleaks detect` command against your current workspace and surfaces the findings directly within the VS Code UI, making it easy to identify and remediate potential security risks.
