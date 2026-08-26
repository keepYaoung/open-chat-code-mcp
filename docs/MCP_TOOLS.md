# MCP Tool Guide

[Korean version](MCP_TOOLS.ko.md)

This is the user-facing reference for the 23 tools exposed by Open Chat Code MCP. Before using a write, execution, deletion, permission, or network-affecting tool, tell the user which tool will be used and its purpose. Only execute when the user explicitly asks to execute in the current chat session.

## Read and Diagnose

| Tool | Use it for | Notes |
| --- | --- | --- |
| `doctor` | Check host health, configured roots, Git summary, disk space, auth, sandbox, and HTTPS health. | Read-only. Start here after setup or when a connection looks unhealthy. |
| `check_security_updates` | Compare security-sensitive host code with the configured official source. | Run before the first coding task each day. Review before changing files if it reports `security_review_required`. |
| `list_directory` | Inspect a directory tree. | Use bounded depth and entry limits for large repositories. |
| `stat_path` | Check whether a path is a file, directory, or symbolic link. | Read-only metadata. |
| `read_file` | Read UTF-8 text or a bounded file chunk. | Use `nextOffset` for large files. |
| `download_file` | Read binary or base64 file chunks. | Use `nextOffset` until `eof=true`. |
| `hash_file` | Verify file contents or get a SHA-256 precondition. | Prefer SHA-256 before an exact patch. |
| `read_process` | Read newer output from a managed command. | Pass the prior `nextSeq` as `afterSeq`. |
| `list_processes` | Inspect running and recently completed commands. | Read-only process-session list. |

## Edit Files and Directories

| Tool | Use it for | Notes |
| --- | --- | --- |
| `write_file` | Create, replace, or append one file. | Explain overwrite or append behavior first. |
| `replace_in_file` | Make one exact text replacement. | Defaults to one matching occurrence to avoid ambiguous edits. |
| `apply_partial_patch` | Make one or more atomic exact replacements in a single UTF-8 file. | Prefer for small edits; pair with `hash_file` and `expectedSha256` when stale content is a risk. |
| `apply_patch` | Apply a unified diff across one or more files. | Use `checkOnly=true` first when practical. |
| `upload_file` | Upload a base64 file in chunks. | Use `truncate=true` for the first chunk of a replacement upload. |
| `make_directory` | Create a directory. | Explain the target path. |
| `copy_path` | Copy a file or directory. | Confirm the destination and overwrite behavior. |
| `move_path` | Move or rename a file or directory. | Confirm the destination; do not overwrite unless requested. |
| `remove_path` | Permanently remove a file or directory. | No Trash recovery. Always state the exact target and get explicit approval. |
| `chmod_path` | Change Unix file permissions. | State the old intent and requested mode, such as `0755`. |

## Execute and Operate

| Tool | Use it for | Notes |
| --- | --- | --- |
| `exec_command` | Run a shell command: Git, tests, builds, package commands, logs, services, or local apps such as Xcode. | Powerful. It runs on the connected host. With `MCP_MACOS_SANDBOX=false`, it has the LaunchAgent user's broader macOS command access. |
| `run_script` | Run a complete Bash, sh, Node.js, Python, or custom-interpreter script. | Use when a task needs multi-step, structured logic rather than one shell command. Treat it with the same care as `exec_command`. |
| `write_stdin` | Send input to a managed long-running command. | Use only with the `sessionId` returned by an execution tool. |
| `terminate_process` | Stop a managed command with `SIGINT`, `SIGTERM`, or `SIGKILL`. | Explain which process will be stopped; prefer `SIGINT` or `SIGTERM` before `SIGKILL`. |

## Path and Process Rules

- Relative paths use `MCP_DEFAULT_CWD`.
- File tools are limited to `MCP_ALLOWED_PATHS` when configured. Do not use broad personal folders as allowed roots.
- `exec_command` and `run_script` may have broader operating-system access than file tools, especially when `MCP_MACOS_SANDBOX=false`.
- A command that has not completed returns a `sessionId`; poll it with `read_process`, or use `write_stdin` and `terminate_process` when appropriate.
- After changes, inspect the actual checkout with Git status and diff, then have Codex, Claude, Cursor, or another dedicated coding tool review the local changes.
