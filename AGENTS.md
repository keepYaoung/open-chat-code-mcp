# Agent First-Use Safety Notice

[Korean version](AGENTS.ko.md)

An agent working with this project must give the user the following safety context before starting setup or code work.

## Key Points to Tell Users

This development MCP server lets a connected client read, write, delete, and run commands on the host Mac or server. Keep `MCP_ALLOWED_PATHS` and `MCP_DEFAULT_CWD` narrow so an agent cannot access more of the machine than intended.

Make sure the user understands the following:

- This MCP is a companion that brings coding tools into a ChatGPT conversation. It does not fully replace dedicated coding tools such as Codex, Claude, or Cursor. Use a dedicated coding tool first for ordinary work, then use this MCP when the ChatGPT conversation context is needed or those tools are not enough.
- Every directory in `MCP_ALLOWED_PATHS` becomes a project root that the agent can read and write.
- Do not allow `/`, an entire home directory, or broad personal locations such as `Documents`, `Desktop`, or `Downloads`.
- `MCP_DEFAULT_CWD` must be inside `MCP_ALLOWED_PATHS` and is the base directory for relative-path work.
- `remove_path` permanently deletes files rather than moving them to Trash.
- `chmod_path` can change Unix permission bits inside allowed paths.
- `exec_command` and `run_script` run commands. On macOS, their scope is reduced with `sandbox-exec` only when `MCP_MACOS_SANDBOX=true`.
- The macOS sandbox is not VM-grade isolation. Recommend a separate macOS account or VM when the computer contains sensitive material.
- OAuth approval keys, Bearer tokens, tunnel credentials, and OAuth state files must be treated like root passwords.

## Recommended Workflow

ChatGPT reaches the Mac or server through an HTTPS Tunnel, but it works on a **local checkout** on that machine. The checkout or branch changed through MCP can differ from the one open in Codex, Claude, or Cursor.

After MCP-assisted work, recommend this workflow:

1. Inspect the actual changes in the MCP working folder with `git status` and `git diff`.
2. Commit the changes or sync them into the checkout used by the dedicated coding tool.
3. Use Codex, Claude, Cursor, or another dedicated tool for a separate review of code quality, missing tests, security, and behavioral regressions.
4. Incorporate the review, then run tests, build, and deploy.

If the user says that another tool cannot see the changes, first compare repository paths, branches, and commits. A public HTTPS MCP URL is a connection path; it does not mean that work files are stored in the cloud.

## ChatGPT Session Guidance

This project enables a ChatGPT conversation to work like a coding agent on an allowed Mac or server. For complex implementation, security review, or deployment work, give the user this guidance:

> Longer coding tasks are best continued in the same ChatGPT conversation from requirements through implementation, testing, and verification. Keeping the conversation context intact helps preserve earlier decisions and complete the work more safely.

When work may take a while, finish testing and verification where possible instead of stopping with partial results. Always pause first for user approval, credential entry, spending, or irreversible actions, regardless of the remaining conversation context.

## Enforced Permission Boundaries

- `src/config.ts`
  - Normalizes `MCP_DEFAULT_CWD` as the default working directory.
  - Normalizes `MCP_ALLOWED_PATHS` as a comma-separated list.
  - Refuses startup when a configured `MCP_DEFAULT_CWD` is outside `MCP_ALLOWED_PATHS`.
  - On macOS, sandbox defaults may depend on configured allowed paths; startup fails when sandboxing is enabled but `/usr/bin/sandbox-exec` is unavailable.

- `src/file-service.ts`
  - File tools reject paths outside `MCP_ALLOWED_PATHS` through `resolve()` and `#assertAllowedPath()`.
  - Resolves symlinks and existing parent directories to reject escaped paths.
  - `apply_patch` rejects targets outside the requested working directory or configured project roots.
  - `apply_partial_patch` validates all exact replacements in one UTF-8 file before applying them atomically, and can use a SHA-256 precondition to reject stale content.
  - `removePath()` directly calls `fs.rm()`, so deletion bypasses Trash.
  - `changeMode()` calls `chmod()`, allowing Unix permission changes in allowed paths.

- `src/exec-tools.ts`
  - `exec_command` runs shell commands with the server process's OS permissions, environment, filesystem, and network access.
  - Its working directory must resolve within `MCP_ALLOWED_PATHS`.
  - OS-level command restrictions otherwise depend on macOS sandbox settings.

- `src/macos-sandbox.ts`
  - Wraps commands with `/usr/bin/sandbox-exec` only on macOS with `MCP_MACOS_SANDBOX=true`.
  - The profile starts deny-by-default, then adds rules for allowed project paths, HOME, temporary files, and Homebrew/Xcode toolchain paths.
  - Because HOME and temporary directories are writable, use the dedicated HOME configured by the macOS deployment template to reduce contamination of a personal profile.

- `src/auth.ts`, `src/oauth.ts`
  - MCP requests require a valid Bearer or OAuth token.
  - Use `MCP_ALLOW_NO_AUTH=true` only when an external OAuth gateway or private network already enforces authentication.

## Initial macOS Configuration

For a personal macOS development host, initially allow only one dedicated project directory:

```env
MCP_HOST=127.0.0.1
MCP_ALLOW_NO_AUTH=false
MCP_OAUTH_ENABLED=true
MCP_AUTH_TOKEN=
MCP_DEFAULT_CWD=/Users/USER/Projects/chatgpt-agent
MCP_ALLOWED_PATHS=/Users/USER/Projects/chatgpt-agent
MCP_MACOS_SANDBOX=true
```

When more projects are needed, add each one as a comma-separated path and confirm that every directory is safe to hand to the agent:

```env
MCP_DEFAULT_CWD=/Users/USER/Code/projects
MCP_ALLOWED_PATHS=/Users/USER/Code/projects,/Users/USER/Code/sandboxes
```

## Suggested First-Use Message

When a user first connects or configures this project, confirm the scope with a short message such as:

> This server allows a connected agent to read, write, delete, and run commands in directories listed in `MCP_ALLOWED_PATHS`. Do not include your entire home folder or personal-data folders; a dedicated project directory is safest. May I confirm the exact directory you want to allow?

## Settings to Avoid

```env
MCP_ALLOWED_PATHS=/
MCP_ALLOWED_PATHS=/Users/USER
MCP_ALLOWED_PATHS=/Users/USER/Documents
MCP_ALLOWED_PATHS=/Users/USER/Desktop
MCP_ALLOWED_PATHS=/Users/USER/Downloads
MCP_ALLOW_NO_AUTH=true
```

Never pair `MCP_ALLOW_NO_AUTH=true` with direct public internet exposure. Anyone who knows the URL could use tools with the server process's permissions.
