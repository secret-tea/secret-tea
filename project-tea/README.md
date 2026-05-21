# Secret Tea

Secret Tea is designed to protect your project. It provides real-time detection of `sensitive information` from exposing to public source like Github (include API keys, tokens, and hardcoded credentials) and `npm malware dependencies` directly within your development workflow.

## 🌟 What it Does

- **Real-time scan for secrets**: Automatically scans files as you save them, providing instant feedback.
- **Reports**: Generates detailed summary reports of all detected secrets.

## ⚙️ How it Works

* **Secret scanning**: This extension is a wrapper around the `gitleaks` binary. It executes the `gitleaks detect` command against your current workspace and surfaces the findings directly within the VS Code UI, making it easy to identify and remediate potential security risks.
* **Malware scanning**: It use prediction malware list we get from `Aikido Malware`, prevent npm supply chain attack.
