# GitHub AI Companion

A Windows-first desktop developer companion built with Electron, React, TypeScript and SQLite. It provides a transparent animated desktop character, private streaming AI chat, secure provider configuration, GitHub repository browsing/creation, a local project explorer/editor, and a task-planning workspace.

> **Scope note:** this repository is an actively built foundation, not yet the entire product described in the original vision. Implemented features and current limitations are listed honestly below. In particular, agent requests currently produce plans; they do **not** autonomously write code or execute terminal/GitHub tools.

## Build the portable Windows EXE automatically

`.github/workflows/windows-portable.yml` builds a Windows x64 portable executable on every branch push, pull request, or manual workflow run. On a push to a version tag like `v1.0.0`, it also attaches the executable to a GitHub Release.

1. Push the repository to GitHub with Actions enabled.
2. Open **Actions → Build Windows Portable App** to see workflow runs.
3. Download **GitHubAICompanion-Portable-…** from a successful run's Artifacts section (kept for 30 days).
4. To publish a release, push a version tag, e.g. `git tag v1.0.0 && git push origin v1.0.0`; the release contains the portable EXE.

The output is an **unsigned** executable unless you later add a Windows code-signing certificate. Windows SmartScreen may show an unknown-publisher warning. The workflow does not need API secrets to package the app.

## Local development

Requirements: Windows 10/11 (for the real desktop character/tray/system integration), Node.js 22.12+, npm, and optionally [Ollama](https://ollama.com/) for local AI. The renderer and builds can be type-checked on Linux/macOS, but actual Windows packaging is done by the Actions workflow on `windows-latest`.

```powershell
npm ci
npm run typecheck
npm test
npm run dev
```

Build renderer/main/preload bundles:

```powershell
npm run build
```

On Windows, create a portable EXE or NSIS installer:

```powershell
npm run package
npm run package:installer
```

Artifacts are written to `release/`. Configure an AI provider in **AI Models**. Ollama is selected by default; install/run Ollama locally and pull a model (for example `ollama pull llama3.2`). Other providers need their own API key, entered in the app; the key is encrypted through Electron `safeStorage` and never sent to renderer JavaScript.

### GitHub sign-in (optional)

Create a GitHub OAuth App and enable **Device Flow** in the app's settings. Set its public client ID in the environment before launching:

```powershell
setx GITHUB_CLIENT_ID "your-oauth-app-client-id"
```

Restart the app, choose **GitHub → Connect GitHub**, then authorize the one-time code. Device Flow is used so a desktop app does not need to embed or ship an OAuth client secret. The app requests the `repo` and `read:user` scopes; review the scope before authorizing. The returned token is stored via OS-backed encryption.

## What works today

- Transparent, borderless, always-on-top character window; CSS animation states; drag positioning, multi-monitor-aware bounds and persisted position; context actions; visibility, size, and click-through controls.
- Main desktop window, system tray, minimize-to-tray, saved app preferences, Windows login-startup toggle, and keyboard shortcuts (`Ctrl+Shift+G`, `Ctrl+Shift+H`).
- SQLite-backed persistence for settings, provider configurations, conversations, task plans, and activity history.
- Streaming chat through OpenAI-compatible APIs, native Gemini streaming, NVIDIA NIM/OpenAI-compatible endpoints, OpenRouter, custom compatible endpoints, and local Ollama.
- Provider health checks, model discovery where the provider exposes a model endpoint, model parameters, encrypted API keys, Markdown/GFM chat display and copyable code blocks.
- GitHub Device Flow authentication, account status, repository list/create/delete, open-PR and open-issue listing. Repository deletion requires typing the exact owner/name in a confirmation dialog.
- A selected-folder local file browser/editor with path traversal checks, excluded dependency/build folders, a text-file size limit, and explicit save.
- AI-generated request plans and task/activity history. The UI labels this as planning mode and explicitly warns that plans are not executed.
- Unit tests for AI streaming/error handling and SQLite persistence.

## Known limitations / roadmap

This is not yet a complete autonomous developer agent. Pull request and issue **listing** are implemented; creating/reviewing/merging PRs, issue creation/assignment/comments, workflows, notifications/polling/webhooks, Git operations, repository file operations, terminal execution, and tool-permission/approval orchestration are not implemented. The agent currently drafts a plan only. The project explorer reads and writes selected local text files but does not yet provide safe-delete, project indexing, build/test execution, or a code editor's syntax engine. Voice input/output, language/wake-word support, update service, signed installer, crash reporting, and some advanced character animation/accessibility features are also not implemented. UI controls marked unavailable are intentionally disabled rather than simulated.

The initial foundations intentionally avoid unrestricted computer access. Any future tools should be registered with strict typed schemas, project-root scope, auditable results, explicit approval for destructive operations, and post-action verification.

## Security and privacy

- API credentials are stored in encrypted OS-backed Electron `safeStorage`; secure storage unavailability is an error (there is no plaintext fallback).
- Credentials and GitHub tokens stay in the Electron main process. The renderer receives only provider status and `hasKey` metadata.
- The renderer uses context isolation, sandboxing, and a narrow preload API; no Node integration is exposed.
- Project access is limited to a user-selected directory, with normalized path containment and bounded text reads/writes.
- There is no remote font or analytics request. Cloud AI prompts are sent only to the selected AI API; Ollama chat remains local.
- GitHub OAuth token scope is `repo read:user`; private repository features require the broad `repo` scope offered by classic OAuth Apps.

See [Architecture](docs/ARCHITECTURE.md) and [Configuration](docs/CONFIGURATION.md).
