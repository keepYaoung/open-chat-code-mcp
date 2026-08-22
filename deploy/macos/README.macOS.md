# cokacremote on macOS

This variant is prepared for a local Mac that should behave like a ChatGPT-facing coding host.

## Layout

Use a self-contained directory outside `Desktop`, `Documents`, and `Downloads` so macOS can run it as a launch agent. The service keeps its app files, OAuth state, logs, and isolated HOME there:

- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app/config`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app/logs`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app/state/home`
- `/Users/REPLACE_WITH_YOUR_USERNAME/Projects/chatgpt-agent`

## Safety changes in this fork

- `MCP_ALLOWED_PATHS` limits file tools to approved project roots.
- `MCP_MACOS_SANDBOX=true` wraps `exec_command` and `run_script` with `sandbox-exec`.
- The launch agent uses an isolated `HOME` so shell history, npm cache, and git config do not bleed into the normal user profile.
- The service binds to `127.0.0.1`; public access should come only through a trusted HTTPS tunnel or reverse proxy.

## Tunnel guidance

Use a named Cloudflare Tunnel for a stable hostname. Keep `MCP_TRUST_PROXY_HOPS=1` only when exactly one trusted proxy or tunnel terminates the public request before forwarding to the local Node service.

## Remaining limitation

The macOS sandbox here focuses on preventing project-external writes and keeping execution scoped to approved directories plus toolchain paths. It is much safer than the upstream default, but it is still not equivalent to a full VM or container boundary.
