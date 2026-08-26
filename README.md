# Open Chat Code MCP

[한국어 README](README.ko.md)

For agent operating rules, see [AGENTS.md](AGENTS.md) or [AGENTS.ko.md](AGENTS.ko.md).

Use ChatGPT like Codex: this project turns your Mac or server into a coding host that ChatGPT and other MCP clients can use.

`open-chat-code-mcp` exposes coding tools over MCP (Model Context Protocol): file editing, Git, tests, builds, and managed shell commands. The AI client can be on any device, but all work runs on the Mac or server you configure.

```text
ChatGPT or another MCP client
            |
            | MCP over HTTPS
            v
    Open Chat Code MCP
            |
            v
       Your Mac or server
       |- run commands
       |- read/write files
       |- install packages
       |- build and test code
       `- manage processes and services
```

## Start Here

| I want to... | Follow this section |
| --- | --- |
| Use my personal Mac as a ChatGPT coding host | [macOS setup](#macos-use-this-mac-as-a-chatgpt-coding-host) |
| Run a conventional Linux VPS or EC2 host | [Linux quick start](#linux-quick-start) and [VPS deployment](#vpsec2-deployment) |
| Connect ChatGPT after deployment | [Connect ChatGPT](#connect-chatgpt) |
| Understand the exposed capabilities | [Available tools](#available-tools) |

> [!IMPORTANT]
> This is a powerful coding agent, not a sandboxed demo. A connected client can change files and run commands inside every allowed project root. Use OAuth, HTTPS, narrow path restrictions, and a separate macOS account when the computer contains sensitive material.

## What You Get

- A local coding host that starts automatically when you log in
- OAuth 2.1 with Dynamic Client Registration and PKCE for ChatGPT
- A stable HTTPS endpoint through Cloudflare Tunnel without opening a router port
- Optional macOS command sandboxing and explicit writable project roots
- Stateless MCP requests with long-running process polling

## Safe Use and Review Workflow

Open Chat Code MCP is a companion for continuing a ChatGPT conversation with coding access; it does not fully replace dedicated coding tools such as Codex, Claude, or Cursor. Prefer a dedicated coding tool for ordinary code work, then use this MCP when the ChatGPT conversation context is needed or those tools are insufficient.

The public HTTPS address is only a connection path. ChatGPT edits a **local checkout** on the configured Mac or server, so another tool may be looking at a different repository path or branch.

After MCP-assisted work:

1. Inspect the MCP working folder with `git status` and `git diff`.
2. Commit the changes or sync them into the checkout used by the dedicated coding tool.
3. Ask Codex, Claude, Cursor, or another dedicated tool to review code quality, missing tests, security, and behavioral regressions.
4. Incorporate the review, then test, build, and deploy.

Every directory in `MCP_ALLOWED_PATHS` is writable by the connected agent. `remove_path` permanently deletes files, so keep project roots narrow and never place secrets, approval keys, tokens, or tunnel credentials in an allowed project directory.

## Daily Security Update Check

At the first coding task on each local calendar day, the MCP client should call `check_security_updates` and relay a `security_review_required` result before changing project files. The check compares the installed host's security-sensitive paths with the official Open Chat Code MCP source, then records that day's result locally.

This works for forks: it does not assume that your remotes are named `origin` or `upstream`. By default, it checks `https://github.com/keepYaoung/open-chat-code-mcp.git` on `main`. A fork can keep that default to receive official security notices, or deliberately override it with `MCP_SECURITY_SOURCE_URL` and `MCP_SECURITY_SOURCE_REF`.

`security_review_required` means the local security surface differs from the official source. It is a request for review, not proof that a fork is vulnerable: a fork may already contain an equivalent patch or intentionally customize those files. When review is needed, apply the update, run tests and `npm run build`, then restart the MCP service. Restarting alone never applies source code updates.

## Documentation Map

- This README: choose a deployment path, install it, connect ChatGPT, and operate the host.
- [macOS deployment files](deploy/macos/README.macOS.md): what each macOS template does and where local-only state belongs.
- [Windows security and deployment review](docs/WINDOWS.md): current Windows limitations, local-only setup, and safety guidance.
- [Cloudflare Tunnel template](deploy/macos/cloudflared-config.example.yml): public HTTPS routing to the localhost-only service.
- [Environment template](deploy/macos/cokacremote.env.example): the complete list of macOS service settings. Copy it locally; never commit the copy.

## How It Works

1. ChatGPT connects to the public HTTPS endpoint.
2. Cloudflare Tunnel forwards the request only to `127.0.0.1` on your Mac.
3. Open Chat Code MCP verifies OAuth and runs the requested tool within its configured limits.
4. Output returns to the ChatGPT conversation.

> [!WARNING]
> The Linux deployment path remains unrestricted unless you configure its own operating-system controls. Never run it as `root` for ordinary coding work.

## Linux Quick Start

If you already have a Linux server and Node.js 22+, the shortest local test is:

```bash
git clone https://github.com/keepYaoung/open-chat-code-mcp.git
cd open-chat-code-mcp
npm install
npm run build

export MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
export MCP_DEFAULT_CWD=/root
npm start
```

The server starts on port `3000` by default.

- MCP endpoint: `http://127.0.0.1:3000/mcp`
- Health check: `http://127.0.0.1:3000/health`

For a real remote ChatGPT connection, you will normally also need:

1. A public HTTPS domain such as `https://mcp.example.com`
2. Nginx or another reverse proxy in front of the Node.js service
3. OAuth enabled for ChatGPT, or a Bearer token for clients that support one
4. The MCP URL added in ChatGPT, for example `https://mcp.example.com/mcp`

The macOS guide below is the recommended path for a personal coding host.

### Universal host mode: GUI apps and unrestricted shell access

`exec_command` and `run_script` are already general shell tools. With macOS sandboxing disabled, they can launch GUI applications in the logged-in Mac session and use the installed developer toolchain, for example:

```bash
open -a Xcode /Users/USER/Code/my-app
xcodebuild -project MyApp.xcodeproj -scheme MyApp build
```

Choose the mode deliberately:

| Setting | Use it when | Shell command scope |
| --- | --- | --- |
| `MCP_MACOS_SANDBOX=true` | You want project-contained development work with reduced macOS command access. | Limited by the generated macOS sandbox profile. GUI application launching may be unavailable. |
| `MCP_MACOS_SANDBOX=false` | You intentionally want a Codex-like universal host that can open Xcode and use the full local developer environment. | The LaunchAgent user's broader macOS permissions. |

This setting does **not** remove the `MCP_ALLOWED_PATHS` restriction from file tools, but `false` allows shell commands to act outside project roots. OAuth still controls who can connect, yet an approved client can use those broader command permissions. Keep the MCP host account separate from sensitive personal data when possible.

## Typical Tasks

Typical tasks include:

- "Show me the current RAM and disk usage."
- "Find why Nginx is returning 502."
- "Edit this config file and restart the service."
- "Clone this Git repository and run its tests."
- "Install Node.js packages and build the project."
- "Upload a file, verify its hash, and move it into place."

Internally, these actions are provided through 20 MCP tools for shell execution, long-running processes, and filesystem operations.

## Key Features

- Shell commands, complete scripts, builds, tests, package installation, Git, and service management
- Output polling, stdin delivery, and termination control for long-running processes
- Read, write, edit, transfer, and delete host files, including absolute paths
- Built-in static Bearer authentication and OAuth 2.1/DCR/PKCE for ChatGPT
- Stateless JSON transport per request, per-process output retention, and response size limits
- systemd and Nginx deployment examples for Linux VPS/EC2 environments

## Available tools

### Execution and processes

- `exec_command`: Run shell commands, builds, tests, package installation, Git, service management, and log inspection
- `run_script`: Run complete scripts with Bash, sh, Node.js, Python, or an arbitrary interpreter
- `write_stdin`: Write input to a long-running process and retrieve subsequent output
- `read_process`: Poll output using a cursor and inspect process termination state
- `terminate_process`: Send `SIGINT`, `SIGTERM`, or `SIGKILL` to a managed process group
- `list_processes`: List running or recently completed process sessions

### Host diagnostics

- `doctor`: Read-only diagnosis of configured project-root accessibility, Git branch and dirty-file summary, disk capacity, authentication and macOS sandbox settings, plus the public HTTPS `/health` endpoint when configured.
- `check_security_updates`: Once-daily official security-source comparison that works with forks and recommends review, rebuild, and restart only when tracked security-sensitive paths differ.

### Filesystem

- `list_directory`, `stat_path`, `read_file`, `write_file`
- `replace_in_file`, `apply_partial_patch`, `apply_patch`
- `upload_file`, `download_file`, `hash_file`
- `make_directory`, `copy_path`, `move_path`, `remove_path`, `chmod_path`

Relative paths are resolved from `MCP_DEFAULT_CWD`, while absolute paths and `~/...` paths are also allowed. Uploads and downloads use base64 chunk transfer with `nextOffset`.

The server provides 23 tools in total. Run `doctor` first after installation or when a connection appears unhealthy; it is read-only and does not scan outside configured project roots. `remove_path` permanently deletes targets without using a trash folder. Use `apply_partial_patch` for atomic, exact replacements in one UTF-8 file; optionally provide a SHA-256 from `hash_file` to reject stale content. Use `apply_patch` for unified diffs across files. It validates every patch target and rejects paths outside the requested working directory and configured project roots.

## Project Tree Catalog (Planned)

The next management layer will be a read-only project tree built from configured project roots. It is intended for a first-run infrastructure setup: the agent discovers allowed repositories and their directory structure, then keeps a small, explicit status index for later conversations.

- It will scan only `MCP_ALLOWED_PATHS`, never a whole home directory.
- It will represent folders and repositories as parent-child tree nodes, not a general graph.
- It will exclude `.git`, dependency directories, build output, and user-configured ignored paths by default.
- Each repository node will retain safe metadata such as branch, dirty state, detected package files, and documented test/build commands.
- Refreshing the catalog will be read-only. It will not install dependencies, change files, or run project commands without a separate request.

Use `doctor` for the current host state; the catalog will provide the broader repository-and-folder map after initial setup.

### File reading and transfer rules

- `offset`, `bytesRead`, and `nextOffset` returned by `read_file` are all byte offsets or byte counts.
- With `encoding="utf8"`, multibyte characters such as Korean text and emoji are never split across chunk boundaries. `bytesRead` may exceed the requested `maxBytes` by up to 3 bytes when necessary to include one complete character, but it never exceeds the server's `MCP_MAX_FILE_CHUNK_BYTES` limit.
- Invalid UTF-8 is rejected instead of silently replacing invalid bytes. Read binary files with `encoding="base64"`.
- Base64 input for `write_file` and `upload_file` is strictly validated for alphabet, length, and padding. Standard base64 without padding is also accepted, while invalid input is rejected before the file is modified.
- `write_file.fileMode` applies both to new files and when overwriting or appending to existing files.
- `copy_path` returns a conflict error for both files and directories when the destination already exists and `force=false`.

## Transport and state model

`/mcp` is a stateless Streamable HTTP JSON endpoint where every request is handled independently.

- Each `POST /mcp` request is handled with a new MCP transport and does not issue or require an `Mcp-Session-Id`.
- If an older client sends a stale `Mcp-Session-Id` header, the server ignores it for request processing.
- An authenticated `GET /mcp` or `DELETE /mcp` request returning `405 Method Not Allowed` is expected. Missing or invalid authentication may produce `401 Unauthorized` before the request reaches that method check. The server does not maintain a server-push SSE session.
- MCP transport sessions and command process `sessionId` values are unrelated. A process `sessionId` returned by `exec_command` can be reused by later HTTP requests to `write_stdin`, `read_process`, and `terminate_process`.
- Running and retained process state is stored in service memory and is lost when the service restarts.

## Requirements

- Node.js 22 or later and npm
- Linux recommended; the provided production deployment examples target systemd and Nginx
- Git for `apply_patch`
- OpenSSL for key generation
- Python 3 if Python execution through `run_script` is needed
- A stable, publicly accessible HTTPS domain when connecting directly from ChatGPT

## macOS: Use This Mac as a ChatGPT Coding Host

This project includes a macOS-oriented deployment path for running Open Chat Code MCP on a personal Mac while keeping it limited to one or more project directories.

> [!IMPORTANT]
> This is still a powerful coding agent. The macOS sandbox and path restrictions reduce the damage a mistake can cause; they do not provide the isolation of a virtual machine. `sandbox-exec` is a legacy macOS facility, so use a dedicated macOS account or VM when the Mac contains sensitive data. When `MCP_MACOS_SANDBOX=true`, the service fails to start if that executable is unavailable.

### 1. Choose safe locations

Use a directory outside `Desktop`, `Documents`, and `Downloads` for the **service files**. macOS privacy controls can prevent a background launch agent from reading those folders. This guide uses:

```text
/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote
/Users/REPLACE_WITH_YOUR_USERNAME/Projects/chatgpt-agent
```

The second directory is the only project root that the MCP server is allowed to read or write. Keep the **service files** outside protected folders. Project roots can be elsewhere, but every listed root becomes writable by the connected AI client.

Before continuing, install Node.js 22 or later, Git, and Cloudflare Tunnel. With Homebrew on an Apple-silicon Mac:

```bash
brew install node git cloudflared
node --version
cloudflared --version
```

If Homebrew is installed under `/usr/local` rather than `/opt/homebrew`, replace the executable paths in the LaunchAgent templates below.

### 2. Install the service files

```bash
git clone https://github.com/keepYaoung/open-chat-code-mcp.git
cd open-chat-code-mcp
npm ci
npm run build
npm prune --omit=dev

mkdir -p "/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote"
mkdir -p "/Users/REPLACE_WITH_YOUR_USERNAME/Projects/chatgpt-agent"
cp -a . "/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app"
```

Copy the public template and edit the copied file only. Never commit this file.

```bash
cd "/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app"
mkdir -p config logs state/home
cp deploy/macos/cokacremote.env.example config/cokacremote.env
chmod 600 config/cokacremote.env
openssl rand -hex 32
```

Set the generated value as `MCP_OAUTH_APPROVAL_KEY` in `config/cokacremote.env`. Keep `MCP_AUTH_TOKEN` empty for an OAuth-only setup. Set `MCP_DEFAULT_CWD` and `MCP_ALLOWED_PATHS` to the dedicated project directory above, and leave `MCP_MACOS_SANDBOX=true`.

To allow more than one project root, use a comma-separated allow list and keep the default working directory inside one of those roots:

```dotenv
MCP_DEFAULT_CWD=/Users/REPLACE_WITH_YOUR_USERNAME/Code/projects
MCP_ALLOWED_PATHS=/Users/REPLACE_WITH_YOUR_USERNAME/Code/projects,/Users/REPLACE_WITH_YOUR_USERNAME/Code/sandboxes
```

Do not use `/` or your whole home directory as an allowed path.

### 3. Publish HTTPS through Cloudflare Tunnel

The Node.js service listens only on `127.0.0.1:3000`; Cloudflare Tunnel provides the public HTTPS hostname without opening an inbound router port.

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create chatgpt-coding-host
cloudflared tunnel route dns chatgpt-coding-host mcp.example.com
```

Copy `deploy/macos/cloudflared-config.example.yml` to `~/.cloudflared/config.yml`, replace the tunnel ID and hostname, then validate it:

```bash
cloudflared tunnel ingress validate
cloudflared tunnel --config ~/.cloudflared/config.yml run chatgpt-coding-host
```

Set all of these values in `config/cokacremote.env` to the same public hostname before starting the MCP server:

```dotenv
MCP_PUBLIC_URL=https://mcp.example.com
MCP_ALLOWED_HOSTS=mcp.example.com,127.0.0.1,localhost
MCP_OAUTH_ISSUER=https://mcp.example.com
MCP_OAUTH_RESOURCE=https://mcp.example.com/mcp
```

The tunnel credential JSON in `~/.cloudflared/` is a secret. Do not copy it into this repository or upload it to a cloud drive.

### 4. Start automatically at login

Copy both LaunchAgent templates to `~/Library/LaunchAgents/`. Replace every `REPLACE_WITH_YOUR_USERNAME` value. In the Cloudflare template also replace `chatgpt-coding-host` if you chose another tunnel name.

```bash
cp deploy/macos/com.example.cokacremote.plist ~/Library/LaunchAgents/com.example.cokacremote.plist
cp deploy/macos/com.example.cloudflared.plist ~/Library/LaunchAgents/com.example.cokacremote-cloudflared.plist
plutil -lint ~/Library/LaunchAgents/com.example.cokacremote.plist
plutil -lint ~/Library/LaunchAgents/com.example.cokacremote-cloudflared.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.example.cokacremote.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.example.cokacremote-cloudflared.plist
launchctl kickstart -k "gui/$(id -u)/com.example.cokacremote"
launchctl kickstart -k "gui/$(id -u)/com.example.cokacremote-cloudflared"
curl --fail http://127.0.0.1:3000/health
curl --fail https://mcp.example.com/health
```

The agent uses an isolated `HOME` for its shell history, npm cache, and Git configuration. Its logs are in the installation directory under `logs/`. If startup fails, check `logs/stderr.log` for the MCP server and `logs/cloudflared-error.log` for the tunnel.

### 5. Connect ChatGPT

> [!IMPORTANT]
> Register this MCP in the **ChatGPT web app**, not only in the Codex desktop app. A desktop-only MCP connection does not automatically expose tools to ChatGPT web conversations.

In the ChatGPT web app, add a custom connector using:

```text
https://mcp.example.com/mcp
```

Complete the OAuth approval flow and enter `MCP_OAUTH_APPROVAL_KEY` only on the local approval page. Treat it like a root password and rotate it if it is ever disclosed.

If an authenticated dashboard helps administer this host, its required connection guide must reveal both the MCP HTTPS URL and the OAuth approval key together, and only to an active administrator. Store that key as a server-side secret, never in D1, static assets, or browser-readable configuration. Remove it from the page as soon as the guide closes.

### Execution preference

Save this preference in the ChatGPT instructions for the account or project that uses this host:

> Do not start Work, agent mode, or MCP tool execution unless I explicitly ask you to execute in this chat session.

This keeps planning, explanation, and code review in the chat by default. It does not bypass any ChatGPT product policy, but it makes the user's intent to execute explicit before a connected host is used.

### Public-repository checklist

- Commit `deploy/macos/*.example.*` files only, never `config/cokacremote.env`.
- Never commit OAuth state, Cloudflare credential JSON, access tokens, private keys, or real hostnames.
- Keep the server bound to `127.0.0.1`; do not expose port `3000` directly to the internet.
- Review `MCP_ALLOWED_PATHS` before connecting. Every listed directory is writable by the agent.
- Keep `MCP_OAUTH_APPROVAL_KEY`, `config/cokacremote.env`, `state/oauth-state.json`, and `~/.cloudflared/*json` on the Mac only.
- Run `git status --ignored` before publishing to confirm local credentials are not staged.

## Local development

The Quick Start above is enough to run a normal local instance. If you are changing the source code itself, development mode automatically watches the TypeScript entry point:

```bash
MCP_AUTH_TOKEN=development-token npm run dev
```

## Authentication

When `MCP_AUTH_TOKEN` is set, every MCP request requires the following header:

```http
Authorization: Bearer <MCP_AUTH_TOKEN>
```

You can also enable the built-in OAuth 2.1 Authorization Server for ChatGPT connections. The following values are environment-file examples, not shell commands:

```dotenv
MCP_OAUTH_ENABLED=true
MCP_OAUTH_APPROVAL_KEY=<separate-value-generated-with-openssl-rand-hex-32>
MCP_PUBLIC_URL=https://mcp.example.com
MCP_OAUTH_ISSUER=https://mcp.example.com
MCP_OAUTH_RESOURCE=https://mcp.example.com/mcp
MCP_OAUTH_STATE_FILE=/var/lib/remote-dev-mcp/oauth-state.json
```

When enabled, the server provides:

- RFC 9728 Protected Resource Metadata
- RFC 8414 Authorization Server Metadata
- Dynamic Client Registration (DCR)
- Authorization Code + PKCE (S256)
- `resource` audience validation
- Access tokens, replay-detecting refresh token rotation, and grant-level token revocation

OAuth uses a single `mcp:tools` scope. Enter the `MCP_OAUTH_APPROVAL_KEY` value on the approval page shown when authorizing a ChatGPT connection. For OAuth-only deployments, it is recommended to leave `MCP_AUTH_TOKEN` empty so there is no permanent static Bearer bypass path. For backward compatibility, `MCP_AUTH_TOKEN` is used as the approval key when no dedicated approval key is configured, but keeping the two values separate is safer. Treat both values like root credentials. Registered clients, client secrets, and token hashes are stored in `MCP_OAUTH_STATE_FILE` with mode `600`.

OAuth-related HTTP routes:

| Path | Purpose |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728 resource metadata |
| `/.well-known/oauth-protected-resource/mcp` | Resource metadata for the `/mcp` path |
| `/.well-known/oauth-authorization-server` | RFC 8414 authorization server metadata |
| `/register` | Dynamic Client Registration |
| `/authorize` | User approval and authorization code issuance |
| `/token` | Authorization code / refresh token exchange |
| `/revoke` | Token revocation |

If authentication is handled by an OAuth proxy or private network in front of the server, the built-in authentication checks can be disabled:

```dotenv
MCP_AUTH_TOKEN=
MCP_OAUTH_ENABLED=false
MCP_ALLOW_NO_AUTH=true
```

`MCP_ALLOW_NO_AUTH=true` does not enable anonymous mode while `MCP_AUTH_TOKEN` remains set or OAuth is enabled. When using an external IdP or OAuth gateway, bind the Node.js server only to `127.0.0.1` and complete authentication at the upstream layer. Exposing an unauthenticated MCP server to the public internet allows anyone who knows the URL to use the instance with the server process's full privileges.

OpenAI's current remote MCP authentication requirements are documented in [MCP server authentication](https://developers.openai.com/plugins/build/auth).

## VPS/EC2 deployment

The following example installs the server under `/opt/remote-dev-mcp` on an Ubuntu-based system. The service unit remains named `remote-dev-mcp.service` for backward compatibility.

```bash
sudo mkdir -p /opt/remote-dev-mcp
sudo cp -a package.json package-lock.json tsconfig.json src deploy /opt/remote-dev-mcp/
cd /opt/remote-dev-mcp
sudo npm ci
sudo npm run build
sudo npm prune --omit=dev

sudo install -d -m 0700 /var/lib/remote-dev-mcp

sudo cp deploy/remote-dev-mcp.env.example /etc/remote-dev-mcp.env
sudo chmod 600 /etc/remote-dev-mcp.env
sudo editor /etc/remote-dev-mcp.env

sudo cp deploy/remote-dev-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now remote-dev-mcp
sudo systemctl status remote-dev-mcp
```

If `/usr/bin/node` is not the actual Node.js path, update `ExecStart` in the systemd unit. Use `which node` to find the correct path.

HTTPS is required when exposing the server to the public internet. Update the domain and certificate paths in the [Nginx example](deploy/nginx.remote-dev-mcp.conf), prepare a valid certificate, and then enable the configuration. It is recommended to bind the Node.js server to `127.0.0.1` and expose only ports 80/443 externally. Use a sufficiently long proxy read timeout so long-running tool calls are not terminated by the proxy first.

Set `MCP_TRUST_PROXY_HOPS=1` only when exactly one trusted proxy sits in front of the Node.js server, as in the provided Nginx example. Do not reuse that value when exposing the Node.js port directly or when the proxy hop count differs. Incorrectly trusting `X-Forwarded-For` can allow OAuth rate limits to be bypassed.

At minimum, update the following production environment values for your actual domain:

```dotenv
MCP_HOST=127.0.0.1
MCP_PUBLIC_URL=https://mcp.example.com
MCP_ALLOWED_HOSTS=mcp.example.com,127.0.0.1,localhost
MCP_TRUST_PROXY_HOPS=1
MCP_AUTH_TOKEN=
MCP_OAUTH_ENABLED=true
MCP_OAUTH_APPROVAL_KEY=<value-generated-with-openssl-rand-hex-32>
MCP_OAUTH_ISSUER=https://mcp.example.com
MCP_OAUTH_RESOURCE=https://mcp.example.com/mcp
```

## Connect ChatGPT

Assume the deployed MCP URL is `https://mcp.example.com/mcp`.

The UI for adding an MCP server can differ by plan and workspace type. OpenAI's current Plugins Quickstart describes a personal developer-mode flow that enables **Settings → Security and login → Developer mode** and then adds the MCP server through ChatGPT Plugins. Business/Enterprise/Edu full-MCP app flows may instead use **Settings → Apps → Advanced Settings** or the administrator path **Workspace Settings → Apps → Create**.

> [!IMPORTANT]
> Complete this registration in the **ChatGPT web app**. Adding the server only in Codex desktop does not make its tools available in ChatGPT web chats.

1. Enable **Developer mode** for the account or workspace you are using.
2. In ChatGPT's Plugins or Apps settings, create a new MCP connection and enter `https://mcp.example.com/mcp` as the MCP URL.
3. If an OAuth registration method can be selected, choose **Dynamic Client Registration (DCR)**. Because this server provides DCR, you do not need to create a Client ID and Client Secret manually.
4. Use the `mcp:tools` scope. For a public client flow, the token endpoint authentication method can be `none`.
5. When the OAuth approval page appears, enter `MCP_OAUTH_APPROVAL_KEY` to approve the connection.
6. Complete tool discovery or connection verification, then enable the app/plugin.

For a dashboard-managed host, provide an active-admin-only connection guide that shows the endpoint and approval key together. The approval key must be a server-side secret, not a D1 value or static configuration, and the browser should clear it when the guide closes.

Before using a host with command or file-modification tools, save an execution preference in ChatGPT instructions: only start Work, agent mode, or MCP tool execution when the user explicitly asks to execute in the current chat session.

This server provides DCR and OAuth Authorization Code + PKCE (S256), but does not provide CIMD or OIDC. ChatGPT continues to support DCR, although CIMD may be preferred when an authorization server provides it. For this server, which provides DCR only, use the DCR flow.

Full MCP write/modify capabilities vary by plan and workspace policy. This server includes destructive tools such as file modification, command execution, and deletion, so not every capability will be available if the connection UI restricts tool permissions.

See the official [ChatGPT Plugins Quickstart](https://developers.openai.com/plugins/quickstart), [OpenAI Help Center guide to Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta), and [MCP server authentication](https://developers.openai.com/plugins/build/auth). When using the OpenAI Responses API, see [MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) for how to provide the server URL and required authentication information.

## Operations and troubleshooting

```bash
# Check the Node.js service behind the local proxy
curl http://127.0.0.1:3000/health

# Check the public HTTPS endpoint
curl https://mcp.example.com/health

# Service status and live logs
sudo systemctl status remote-dev-mcp
sudo journalctl -u remote-dev-mcp -f

# Restart after changing configuration or code
sudo systemctl restart remote-dev-mcp
```

Example healthy response:

```json
{
  "status": "ok",
  "service": "cokacremote",
  "version": "0.1.0",
  "transportMode": "stateless-json",
  "activeMcpSessions": 0,
  "activeMcpRequests": 0,
  "managedProcesses": 0,
  "unrestrictedHostAccess": true,
  "oauthEnabled": true
}
```

- `activeMcpSessions` is always `0` in stateless mode. This does not mean the connection is broken.
- `activeMcpRequests` is the number of MCP HTTP requests being processed at the time of the health request.
- `managedProcesses` includes both currently running processes and recently completed processes retained temporarily for output retrieval. Check the `status` field from `list_processes` to determine whether a process is still running. Completed records are removed after `MCP_PROCESS_RETENTION_MS`.
- Every MCP response includes an `X-Request-Id` for tracing. Service log entries with `event="mcp_request"` record the RPC method, tool name, HTTP status, outcome, and duration without logging authentication tokens or tool arguments.

To inspect recent MCP request logs only:

```bash
sudo journalctl -u remote-dev-mcp -o cat | grep '"event":"mcp_request"'
```

- `Error fetching OAuth configuration`: Check `MCP_OAUTH_ENABLED`, the public URL, and the Nginx proxy for `/.well-known/` routes.
- `401 Unauthorized` on MCP requests: Check the Bearer token or OAuth access token.
- `403 Host header is not allowed`: Add the request domain to `MCP_ALLOWED_HOSTS`.
- A command returns a `sessionId` instead of completing immediately: Poll it with `read_process` or send input with `write_stdin`.
- MCP requests are independent stateless POST requests. An authenticated `GET /mcp` or `DELETE /mcp` returning `405 Method Not Allowed` is expected and means the server does not provide a separate SSE stream. Authentication failures may return `401 Unauthorized` first.
- Service restart behavior: Managed process state and unexchanged authorization codes are lost. OAuth client registrations and issued tokens remain in the state file.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The default tests use a real Streamable HTTP MCP client and cover:

- Bearer authentication, stateless request processing, and request tracing headers
- Success paths, failure paths, and input boundary cases for all 20 tools
- Interactive stdin, output pagination, timeouts, termination, and completed-process retention
- UTF-8 character boundaries, strict base64 validation, file modes, and copy/move conflicts
- Unified diff validation, application, reverse application, and 3-way application

### Full E2E verification against a running external MCP server

From a separate source checkout with development dependencies installed, you can verify all 20 tools against a real HTTPS endpoint:

```bash
MCP_E2E_URL='https://mcp.example.com/mcp' \
MCP_E2E_TOKEN='<bearer-token>' \
MCP_E2E_ROOT='/tmp/cokacremote-tools-e2e-manual' \
npx vitest run test/all-tools.integration.test.ts
```

This verification executes real commands on the target server and creates, modifies, and deletes test files. For safety, `MCP_E2E_ROOT` must match the `/tmp/cokacremote-tools-e2e-*` pattern. The test uses only that isolated directory and attempts to clean it afterward. Do not point it at a directory containing production data, and check whether the directory remains after a failed or interrupted test. Running `npm ci` inside the production installation directory may alter its production-only dependency layout, so run tests from a separate checkout instead.

## Key environment variables

| Variable | Default | Description |
|---|---:|---|
| `MCP_HOST` | `0.0.0.0` | HTTP bind address |
| `MCP_PORT` | `3000` | HTTP port |
| `MCP_ENDPOINT` | `/mcp` | Streamable HTTP MCP path |
| `MCP_PUBLIC_URL` | none | External HTTPS base URL excluding `/mcp` |
| `MCP_ALLOWED_HOSTS` | none | Comma-separated list of allowed Host header hostnames |
| `MCP_TRUST_PROXY_HOPS` | `0` | Number of trusted reverse-proxy hops; keep `0` when directly exposed |
| `MCP_AUTH_TOKEN` | none | Optional static Bearer token |
| `MCP_ALLOW_NO_AUTH` | `false` | Allow startup without authentication |
| `MCP_OAUTH_ENABLED` | `false` | Enable built-in OAuth 2.1/DCR for ChatGPT |
| `MCP_OAUTH_APPROVAL_KEY` | `MCP_AUTH_TOKEN` | Dedicated key for the OAuth connection approval page |
| `MCP_OAUTH_ISSUER` | `MCP_PUBLIC_URL` | OAuth issuer URL |
| `MCP_OAUTH_RESOURCE` | `<MCP_PUBLIC_URL><MCP_ENDPOINT>` | MCP resource audience |
| `MCP_OAUTH_STATE_FILE` | inside working directory | Stores registered clients and token hashes |
| `MCP_SECURITY_SOURCE_URL` | `https://github.com/keepYaoung/open-chat-code-mcp.git` | Official security source checked independently of fork remote names |
| `MCP_SECURITY_SOURCE_REF` | `main` | Branch or ref checked in the official security source |
| `MCP_SECURITY_CHECK_STATE_FILE` | next to OAuth state | Local record used to avoid repeating the network check on the same calendar day |
| `MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS` | `3600` | OAuth access token lifetime |
| `MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS` | `2592000` | OAuth refresh token lifetime |
| `MCP_OAUTH_AUTHORIZATION_CODE_TTL_SECONDS` | `300` | One-time authorization code lifetime |
| `MCP_DEFAULT_CWD` | server startup directory | Base directory for relative paths |
| `MCP_DEFAULT_SHELL` | `$SHELL` or `/bin/bash` | Default shell for `exec_command` |
| `MCP_MAX_REQUEST_BODY` | `8mb` | HTTP request body size limit |
| `MCP_MAX_OUTPUT_BYTES` | `1048576` | Maximum output returned by one tool call |
| `MCP_MAX_RETAINED_PROCESS_OUTPUT_BYTES` | `4194304` | Retained output per managed process |
| `MCP_PROCESS_RETENTION_MS` | `3600000` | Retention period for completed processes |
| `MCP_MAX_PROCESSES` | `128` | Maximum number of retained process sessions |
| `MCP_MAX_FILE_CHUNK_BYTES` | `1048576` | Maximum file chunk size; UTF-8 reads also stay within this limit |
| `MCP_MAX_EDIT_FILE_BYTES` | `67108864` | Maximum file size for text replacement |

## Project layout

| Path | Purpose |
|---|---|
| `src/http-server.ts` | Stateless Streamable HTTP, OAuth routing, and health endpoint |
| `src/mcp-server.ts` | MCP server metadata and tool registration |
| `src/exec-tools.ts` | Command, script, and long-running process tools |
| `src/file-service.ts` | File reading, writing, transfer, and path operations |
| `src/file-tools.ts` | Filesystem tools and input schemas |
| `src/oauth.ts` | DCR, PKCE, token issuance/refresh/revocation, and approval UI |
| `deploy/` | systemd, environment-file, and Nginx examples |
| `test/all-tools.integration.test.ts` | E2E tests for all 20 tools and external endpoints |
| `test/` | Configuration, file, process, MCP, and OAuth unit/integration tests |

## License

[MIT License](LICENSE)

## Disclaimer

THIS SOFTWARE IS PROVIDED “AS IS,” WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

IN NO EVENT SHALL THE AUTHOR, COPYRIGHT HOLDERS, OR CONTRIBUTORS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OF THE SOFTWARE.

This includes, but is not limited to:

* Data loss or corruption
* System damage or malfunction
* Security breaches or vulnerabilities
* Financial loss
* Direct, indirect, incidental, special, punitive, or consequential damages

The user assumes full responsibility for all consequences arising from the use of this software, whether such use was intended, authorized, or foreseeable.

**ALL RISKS ASSOCIATED WITH USE ARE BORNE BY THE USER**
