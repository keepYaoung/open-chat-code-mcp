# Open Chat Code MCP on macOS

This directory contains the deployment templates for a local Mac that behaves as a ChatGPT-facing coding host. Follow the full [macOS setup guide](../../README.md#macos-use-this-mac-as-a-chatgpt-coding-host) first; use this page when you need to understand or adjust the files it installs.

> [!IMPORTANT]
> The names `cokacremote` and `com.example.cokacremote` remain in file paths and LaunchAgent labels for backward compatibility. They are local implementation names, not public credentials. Do not rename a running service in place unless you also update its LaunchAgent paths and configuration.

## Local-only layout

Use a self-contained directory outside `Desktop`, `Documents`, and `Downloads` so macOS can run it as a launch agent. The service keeps its app files, OAuth state, logs, and isolated HOME there:

- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app/config`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app/logs`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app/state/home`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Projects/chatgpt-agent`

## What the templates enforce

- `MCP_ALLOWED_PATHS` limits file tools to approved project roots.
- `MCP_MACOS_SANDBOX=true` wraps `exec_command` and `run_script` with `sandbox-exec` and fails closed when that legacy macOS executable is unavailable.
- The launch agent uses an isolated `HOME` so shell history, npm cache, and git config do not bleed into the normal user profile.
- The service binds to `127.0.0.1`; public access should come only through a trusted HTTPS tunnel or reverse proxy.

## Template roles

| File | Purpose | Safe to commit? |
| --- | --- | --- |
| `cokacremote.env.example` | Example settings for paths, OAuth, and localhost binding | Yes |
| `cloudflared-config.example.yml` | Example Cloudflare Tunnel route | Yes, after keeping only placeholders |
| `com.example.cokacremote.plist` | Starts the Node.js service after login | Yes |
| `com.example.cloudflared.plist` | Starts the Cloudflare Tunnel after login | Yes |
| `start-cokacremote.sh` | Loads the local environment file and starts the service | Yes |
| `config/cokacremote.env` | Your actual approval key and machine-specific settings | No |
| `state/oauth-state.json` | OAuth clients and token hashes | No |
| `~/.cloudflared/*.json` | Tunnel credential | No |

## Updating a running Mac

1. Pull the desired source revision into the installation directory.
2. Install dependencies, build, and keep the existing `config/cokacremote.env` untouched.
3. Restart the two LaunchAgents.
4. Confirm both `http://127.0.0.1:3000/health` and the public HTTPS health URL respond successfully.

For complete commands and the required safety checks, return to the [macOS setup guide](../../README.md#macos-use-this-mac-as-a-chatgpt-coding-host).

## Tunnel guidance

Use a named Cloudflare Tunnel for a stable hostname. Keep `MCP_TRUST_PROXY_HOPS=1` only when exactly one trusted proxy or tunnel terminates the public request before forwarding to the local Node service.

## Remaining limitation

The macOS sandbox here focuses on preventing project-external writes and keeping execution scoped to approved directories plus toolchain paths. It is much safer than the upstream default, but it is still not equivalent to a full VM or container boundary. Use a dedicated macOS account or VM for sensitive work.
