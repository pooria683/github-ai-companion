# Architecture

## Chosen stack

- **Electron + TypeScript** for the Windows desktop shell, system tray, transparent/always-on-top windows, safe storage, startup registration, filesystem dialogs, and OS integration.
- **React + Vite** for the dashboard and chat renderer.
- **SQLite via sql.js (WebAssembly)** for portable, native-addon-free local persistence. Database writes export to a temporary SQLite image and atomically replace the user-data database.
- **Octokit REST** for authenticated GitHub operations.
- **fetch + streaming parsers** for provider APIs, avoiding provider SDK key handling in the renderer.
- **Vitest** for unit/integration-style tests with mocked HTTP and OS interfaces.

## Process boundaries

```text
React renderer (sandboxed, context-isolated)
        │ narrow window.companion API
Preload bridge (typed IPC wrappers)
        │ validated channel / structured payload
Electron main process
  ├── SQLite repository
  ├── DPAPI/OS encrypted secret store
  ├── AI provider registry and stream clients
  ├── GitHub OAuth device flow + Octokit services
  ├── scoped local project filesystem
  ├── plan-only agent
  └── windows / character / tray integration
```

Provider API keys, GitHub access tokens, Octokit, filesystem operations, and database writes are main-process concerns. No credentials are returned to the renderer. Production windows use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

## Persistence

`src/main/persistence/store.ts` stores settings, providers, conversations, activity events, and agent plans in `companion.sqlite` under Electron's user-data directory. `src/main/security/secrets.ts` stores the encrypted secret map separately as `secrets.bin`; the settings database only keeps provider metadata and a `hasKey` boolean. The database uses simple JSON payload columns over typed entity tables for schema flexibility; it is SQLite on disk, not a JSON-file substitute.

## AI providers

`AIProvider` is the stream/test contract. The registry returns OpenAI-compatible adapters for OpenAI, NVIDIA NIM, OpenRouter, custom compatible APIs, and Ollama, plus a native Gemini streaming adapter. Deltas are sent over a single IPC event and persisted when a response completes. Provider credentials are read only by the main process. Rate limits and provider-specific errors surface as user-visible request errors; automatic model fallback and token accounting are not implemented yet.

## GitHub authorization

The app uses GitHub's OAuth Device Flow, appropriate for desktop/public clients. The OAuth App's client ID is supplied by the user through `GITHUB_CLIENT_ID`; no client secret is embedded. The token is stored using `safeStorage`, then passed only to Octokit in the main process. Current REST operations are deliberately limited to auth, repository list/create/delete, and open PR/issue reads.

## Filesystem boundary

The local project explorer accepts a user-selected root. Every path is resolved and checked for containment before reading/writing. Reads are bounded to 2 MiB, common binary extensions are rejected, and dependency/build directories are omitted. It has no unrestricted shell or recursive write capability.

## Windows UI

The desktop uses a normal main window plus a separate transparent character `BrowserWindow`. The character position and size live in settings, and a move event updates the saved position. A native tray menu keeps the app available when minimized. Startup uses `app.setLoginItemSettings` without requiring administrator rights.

## Tests

- Provider tests cover OpenAI-compatible event streams, Gemini's native stream format, Ollama JSON lines, and HTTP error propagation.
- Store tests exercise SQLite creation/reopen and persistence of settings, conversations, activity, and task plans.
- Additional GitHub/Windows integration tests need real OAuth/device-flow credentials and a Windows runner; those are not run as unit tests.
