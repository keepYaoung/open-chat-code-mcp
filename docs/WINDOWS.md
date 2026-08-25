# Windows Security and Deployment Review

This project is primarily documented for macOS and Linux. Windows can run the Node.js server, but it does not currently have a Windows equivalent to the macOS `sandbox-exec` wrapper. Treat Windows support as suitable for local-only or private-network use unless you add a separate operating-system isolation layer.

## Recommendation

Use Windows only when all of these are true:

- The server binds to `127.0.0.1`.
- Authentication is enabled.
- `MCP_ALLOWED_PATHS` is set to one narrow workspace directory.
- `MCP_DEFAULT_CWD` is inside that directory.
- You explicitly set `MCP_DEFAULT_SHELL`.
- The Windows user account contains no sensitive personal files the agent can reach.

For internet-facing or always-on use, prefer one of these instead:

- macOS with the provided `MCP_MACOS_SANDBOX=true` setup.
- Linux inside a VM, WSL2 distribution, container, or dedicated low-privilege server user.
- A separate Windows local user plus Windows Sandbox, Hyper-V VM, or another external containment layer.

## Minimal Local Windows Configuration

Use PowerShell from the project root after installing Node.js 22 or later and Git.

```powershell
npm ci
npm run build
```

Set environment variables for the current shell:

```powershell
$env:MCP_HOST = "127.0.0.1"
$env:MCP_PORT = "3000"
$env:MCP_ENDPOINT = "/mcp"
$env:MCP_AUTH_TOKEN = "<replace-with-a-long-random-token>"
$env:MCP_ALLOW_NO_AUTH = "false"
$env:MCP_OAUTH_ENABLED = "false"
$env:MCP_DEFAULT_CWD = "C:\Users\USER\Projects\chatgpt-agent"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER\Projects\chatgpt-agent"
$env:MCP_DEFAULT_SHELL = "powershell.exe"
npm start
```

For PowerShell 7, use:

```powershell
$env:MCP_DEFAULT_SHELL = "pwsh.exe"
```

Do not use the whole user profile as an allowed path:

```powershell
# Unsafe examples
$env:MCP_ALLOWED_PATHS = "C:\"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER\Documents"
$env:MCP_ALLOWED_PATHS = "C:\Users\USER\Downloads"
```

## Code Review Findings

### Path restrictions apply to file tools

`src/config.ts` normalizes `MCP_ALLOWED_PATHS` and rejects startup when `MCP_DEFAULT_CWD` is outside the allow list. `src/file-service.ts` resolves tool paths through `resolve()` and checks both lexical and canonical paths, including symlink escape cases.

This means file tools such as `read_file`, `write_file`, `apply_patch`, `remove_path`, and `chmod_path` are constrained when `MCP_ALLOWED_PATHS` is configured.

### Command execution is not sandboxed on Windows

`src/exec-tools.ts` runs `exec_command` through the configured shell and `run_script` through Bash, sh, Node.js, Python, or a custom interpreter. `src/macos-sandbox.ts` only wraps commands when `process.platform === "darwin"` and `MCP_MACOS_SANDBOX=true`.

On Windows there is no equivalent wrapper in this codebase. The working directory is checked against `MCP_ALLOWED_PATHS`, but the command itself still inherits the server process user's OS permissions, environment, filesystem access, and network access.

### Default shell must be set

`src/config.ts` defaults `MCP_DEFAULT_SHELL` to `$SHELL` or `/bin/bash`. A normal Windows host usually has neither. Set `MCP_DEFAULT_SHELL=powershell.exe`, `pwsh.exe`, or `cmd.exe`.

When using PowerShell, tool callers should send PowerShell syntax, not Bash syntax. Commands such as `ls`, `cat`, and `rm` may behave differently from Unix shells.

### Script runtimes are Unix-biased by default

`run_script` defaults to `bash`. On Windows this only works if Git Bash, WSL, or another Bash is installed and available on `PATH`. Prefer:

- `runtime=node` for Node.js scripts.
- `runtime=python` only if `python3` is available, or pass `interpreter=python`.
- `runtime=custom` with `interpreter=powershell.exe` or `pwsh.exe` for PowerShell scripts.

### Process termination is less complete on Windows

`src/process-manager.ts` uses detached process groups on non-Windows systems and kills the process group with a negative PID. On Windows it falls back to killing only the child process. A command that launches child processes may leave descendants running unless the command handles cleanup itself.

### chmod semantics are limited

The file tools expose `chmod_path`, and `write_file.fileMode` can set modes. Windows permission behavior does not map cleanly to Unix mode bits. Do not rely on `chmod_path` as a Windows security boundary.

## Windows-Specific Safety Checklist

Before connecting an AI client to a Windows host:

- Create a dedicated workspace such as `C:\Users\USER\Projects\chatgpt-agent`.
- Set `MCP_ALLOWED_PATHS` to that exact workspace, not the whole profile.
- Keep source code, test fixtures, and disposable files in that workspace.
- Keep passwords, browser profiles, SSH keys, cloud credentials, photos, and personal documents outside the allowed path.
- Bind to `127.0.0.1` unless a trusted reverse proxy or tunnel handles HTTPS and authentication.
- Do not set `MCP_ALLOW_NO_AUTH=true` unless the server is behind a private network or authenticated upstream gateway.
- Use a dedicated low-privilege Windows account when possible.
- Prefer a VM or WSL2 environment if the agent needs package installs, arbitrary shell work, or long-running services.
- Review commands before approving operations that install software, modify system settings, alter firewall rules, or manage services.

## Public Exposure Guidance

Do not expose the Node.js server directly to the public internet from Windows. If remote access is required, put it behind a trusted HTTPS tunnel or reverse proxy and keep the Node.js service bound to `127.0.0.1`.

For public use, require one of:

- OAuth with a strong `MCP_OAUTH_APPROVAL_KEY`.
- A long random `MCP_AUTH_TOKEN`.
- An upstream gateway that authenticates requests before they reach the Node.js process.

Never combine public exposure with:

```env
MCP_ALLOW_NO_AUTH=true
```

## Current Support Status

Windows is not a hardened deployment target in this repository today. The safest label is:

> Experimental for local/private use. Not recommended for direct public or sensitive-host deployment without external isolation.
