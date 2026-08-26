import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import type { AppConfig } from "./config.js";
import { collectDoctorReport } from "./doctor.js";
import { registerExecTools } from "./exec-tools.js";
import { FileService } from "./file-service.js";
import { registerFileTools } from "./file-tools.js";
import { ProcessManager } from "./process-manager.js";
import { checkSecurityUpdates } from "./security-update-check.js";
import { runTool } from "./tool-result.js";

export interface McpServices {
  processManager: ProcessManager;
  fileService: FileService;
}

export function createServices(config: AppConfig): McpServices {
  return {
    processManager: new ProcessManager({
      maxRetainedOutputBytes: config.maxRetainedProcessOutputBytes,
      processRetentionMs: config.processRetentionMs,
      maxProcesses: config.maxProcesses,
      defaultMaxOutputBytes: config.maxOutputBytes,
    }),
    fileService: new FileService({
      defaultCwd: config.defaultCwd,
      allowedPaths: config.allowedPaths,
      maxChunkBytes: config.maxFileChunkBytes,
      maxEditFileBytes: config.maxEditFileBytes,
      maxOutputBytes: config.maxOutputBytes,
    }),
  };
}

export function createMcpServer(config: AppConfig, services: McpServices): McpServer {
  const server = new McpServer(
    {
      name: "cokacremote",
      version: "0.1.0",
      ...(config.publicUrl ? { websiteUrl: config.publicUrl } : {}),
    },
    {
      instructions:
        "This server is a direct remote host, not a client-side sandbox. When the user asks to inspect, edit, build, test, or operate the connected Mac or server, use the appropriate MCP tool instead of claiming that local access is unavailable or merely suggesting terminal commands for the user to run. exec_command and run_script execute on the connected host; on a macOS universal host they can run commands such as `pwd`, `open -a Xcode`, and `xcodebuild`. File tools, including apply_patch and apply_partial_patch, are constrained to configured project paths when MCP_ALLOWED_PATHS is set. At the first coding task of each local calendar day, call check_security_updates before making changes and clearly relay any security_review_required result to the user. Use apply_partial_patch for small, atomic, single-file edits with an optional SHA-256 precondition. On macOS, exec_command and run_script can also be wrapped in a sandbox when MCP_MACOS_SANDBOX=true. Use exec_command for shell, build, test, package, Git, service, and log workflows; run_script for complete Bash, Node.js, or Python scripts; and the file tools for direct file operations. Poll long-running commands with read_process or write_stdin.",
      capabilities: { logging: {} },
    },
  );

  registerExecTools(
    server,
    config,
    services.processManager,
    services.fileService,
  );
  registerFileTools(server, config, services.fileService);
  server.registerTool(
    "check_security_updates",
    {
      title: "Check official security updates",
      description:
        "Once-daily check against the official Open Chat Code MCP security source. Works for forks without relying on their remote names. Reports whether the installed security-sensitive paths need manual review, update, rebuild, and service restart.",
      inputSchema: {
        force: z.boolean().default(false).describe("Check again even if a result was already recorded today."),
        dryRun: z.boolean().default(false).describe("Show the configured source without making a network request or writing state."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ force, dryRun }) => runTool(() => checkSecurityUpdates(config, force, dryRun)),
  );
  server.registerTool(
    "doctor",
    {
      title: "Diagnose coding host",
      description:
        "Read-only health and configuration check. Reports configured project-root accessibility, Git summary, disk space, authentication and sandbox settings, and the public HTTPS health endpoint when configured.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => runTool(() => collectDoctorReport(config)),
  );
  return server;
}
