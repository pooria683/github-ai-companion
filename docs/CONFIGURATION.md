# Configuration and troubleshooting

## AI providers

Open **AI Models**, select a provider, set its endpoint/model, enter the API key if required, and choose **Test connection**. Secret values are stored in the desktop main process using Electron `safeStorage`; the application refuses plaintext secret storage.

| Provider | Endpoint default | Notes |
| --- | --- | --- |
| Ollama | `http://127.0.0.1:11434` | Start Ollama and pull a model first, e.g. `ollama pull llama3.2`. No cloud key. |
| OpenAI | `https://api.openai.com/v1` | OpenAI API key and model ID required. |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | Google AI Studio API key; uses Gemini's native model-list and streaming REST endpoints. |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | Use the model ID and API key supplied for the selected NVIDIA endpoint. |
| OpenRouter | `https://openrouter.ai/api/v1` | Use the full provider/model identifier. |
| Custom | User-defined | Must implement the OpenAI chat-completions streaming format. |

If `safeStorage` reports unavailable, the app does not save keys. Check the OS keychain/credential services; do not work around this by adding secrets to source files or `.env` committed to Git.

## GitHub OAuth device flow

1. Register a GitHub OAuth App in your GitHub account settings.
2. Enable **Device Flow** for that OAuth App.
3. Set `GITHUB_CLIENT_ID` in the environment that starts the app (on Windows, `setx GITHUB_CLIENT_ID "..."`, then sign out/restart the process).
4. In the app, choose **GitHub → Connect GitHub**, enter the one-time code in the GitHub page and confirm in the app.
5. The app stores the access token encrypted in OS-backed storage. Disconnecting removes the saved token.

If the browser doesn't open, copy the code shown in the desktop dialog and visit `https://github.com/login/device`. Verify that Device Flow is enabled and that the ID belongs to the OAuth App (not a GitHub App installation ID).

## Windows portable workflow

`.github/workflows/windows-portable.yml` runs on pushes to any branch, pull requests, and manual dispatch. It runs `npm ci`, TypeScript checks, unit tests and the Electron production build before creating an x64 portable executable. The EXE is uploaded as a 30-day Actions artifact. Pushing a semantic version tag beginning `v` also creates a GitHub Release with the EXE.

The build is not code-signed by default. For trusted distribution, configure a Windows signing certificate with GitHub Actions secrets and signing in a separate release-hardening change. Never place signing passwords or API credentials in workflow YAML.

## Troubleshooting

- **Ollama offline:** make sure Ollama is running; confirm the configured URL and `ollama list` output.
- **401/403 from a cloud provider:** check the key, model availability, account billing/quotas, and endpoint URL.
- **No models discovered:** some compatible services disable their model-list endpoint; type the provider's exact model ID manually.
- **GitHub client ID missing:** set `GITHUB_CLIENT_ID`, restart the app, and enable Device Flow in the OAuth App configuration.
- **GitHub repository operation denied:** check token authorization, organization policies, repository role, and the granted OAuth scope.
- **Project file not editable:** select the actual project directory; binary files, files above 2 MiB, and paths outside the selected project are rejected.
- **No EXE artifact:** inspect the failed Windows workflow log; the build intentionally fails if the portable EXE is not produced.
- **Windows SmartScreen warning:** unsigned builds are marked unknown publisher. Obtain and configure an EV/OV code-signing certificate for distribution.

## Current feature boundaries

The dashboard's agent workspace prepares a plan only; it does not run terminal commands or modify GitHub/local project files. The GitHub workspace currently supports authentication, repository list/create/delete, and open issue/PR list reads. Voice input/output, real-time GitHub notifications, auto-update, and a signed installer are not part of this release foundation.
