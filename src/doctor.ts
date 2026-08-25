import { execFile as execFileCallback } from "node:child_process";
import { stat, statfs } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";

import type { AppConfig } from "./config.js";

const execFile = promisify(execFileCallback);
const GIT_TIMEOUT_MS = 3_000;
const PUBLIC_ENDPOINT_TIMEOUT_MS = 5_000;

type CheckStatus = "ok" | "warning" | "error" | "not_configured";

interface ProjectDiagnostic {
  path: string;
  accessible: boolean;
  git: {
    status: CheckStatus;
    branch?: string;
    dirtyFileCount?: number;
    summary?: string;
    detail?: string;
  };
  disk?: {
    totalBytes: number;
    availableBytes: number;
    availablePercent: number;
  };
  detail?: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function inspectGit(projectPath: string): Promise<ProjectDiagnostic["git"]> {
  try {
    const { stdout } = await execFile(
      "git",
      ["-C", projectPath, "status", "--short", "--branch"],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: 128 * 1024 },
    );
    const lines = stdout.trimEnd().split("\n");
    const branchLine = lines.find((line) => line.startsWith("## "));
    const changes = lines.filter((line) => line && !line.startsWith("## "));
    return {
      status: changes.length > 0 ? "warning" : "ok",
      branch: branchLine?.slice(3),
      dirtyFileCount: changes.length,
      summary: changes.join("\n") || undefined,
    };
  } catch (error) {
    const detail = errorText(error);
    return {
      status: /not a git repository/i.test(detail) ? "not_configured" : "error",
      detail,
    };
  }
}

async function inspectProject(projectPath: string): Promise<ProjectDiagnostic> {
  try {
    const metadata = await stat(projectPath);
    if (!metadata.isDirectory()) {
      return {
        path: projectPath,
        accessible: false,
        git: { status: "error", detail: "Configured path is not a directory." },
        detail: "Configured path is not a directory.",
      };
    }
    const filesystem = await statfs(projectPath);
    const totalBytes = filesystem.blocks * filesystem.bsize;
    const availableBytes = filesystem.bavail * filesystem.bsize;
    return {
      path: projectPath,
      accessible: true,
      git: await inspectGit(projectPath),
      disk: {
        totalBytes,
        availableBytes,
        availablePercent: totalBytes === 0 ? 0 : Math.round((availableBytes / totalBytes) * 10_000) / 100,
      },
    };
  } catch (error) {
    return {
      path: projectPath,
      accessible: false,
      git: { status: "error", detail: errorText(error) },
      detail: errorText(error),
    };
  }
}

async function inspectPublicEndpoint(publicUrl: string | undefined): Promise<Record<string, unknown>> {
  if (!publicUrl) {
    return { status: "not_configured" satisfies CheckStatus };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_ENDPOINT_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/health", `${publicUrl}/`), {
      signal: controller.signal,
      redirect: "error",
    });
    return {
      status: response.ok ? "ok" : "warning" satisfies CheckStatus,
      url: response.url,
      httpStatus: response.status,
    };
  } catch (error) {
    return { status: "error" satisfies CheckStatus, url: publicUrl, detail: errorText(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectDoctorReport(config: AppConfig): Promise<Record<string, unknown>> {
  const projectPaths = config.allowedPaths?.length ? config.allowedPaths : [config.defaultCwd];
  const projects = await Promise.all(projectPaths.map((projectPath) => inspectProject(projectPath)));
  const warnings: string[] = [];

  if (!config.allowedPaths?.length) {
    warnings.push("MCP_ALLOWED_PATHS is not configured; file access is not restricted to project roots.");
  }
  if (config.allowNoAuth) {
    warnings.push("MCP_ALLOW_NO_AUTH=true permits unauthenticated startup when no other auth is enabled.");
  }
  if (config.host !== "127.0.0.1" && config.host !== "localhost" && config.host !== "::1") {
    warnings.push("MCP_HOST is not loopback-only; use a trusted proxy or tunnel and verify network controls.");
  }
  if (projects.some((project) => !project.accessible)) {
    warnings.push("One or more configured project roots are not accessible.");
  }

  return {
    checkedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      hostname: os.hostname(),
    },
    configuration: {
      defaultCwd: config.defaultCwd,
      allowedPaths: config.allowedPaths ?? [],
      loopbackOnly: config.host === "127.0.0.1" || config.host === "localhost" || config.host === "::1",
      macosSandbox: process.platform === "darwin" ? config.macosSandbox : "not_applicable",
      authentication: config.oauthEnabled ? "oauth" : config.authToken ? "bearer" : "none",
    },
    projects,
    publicEndpoint: await inspectPublicEndpoint(config.publicUrl),
    warnings,
  };
}
