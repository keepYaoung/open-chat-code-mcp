import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { AppConfig } from "./config.js";

const execFile = promisify(execFileCallback);
const GIT_TIMEOUT_MS = 15_000;
const SECURITY_PATHS = [
  "package.json",
  "package-lock.json",
  "src",
  "deploy",
];

interface SecurityCheckState {
  date: string;
  checkedAt: string;
  report: Record<string, unknown>;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function git(appDirectory: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", ["-C", appDirectory, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function readState(stateFile: string): Promise<SecurityCheckState | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(stateFile, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const state = parsed as Partial<SecurityCheckState>;
    return typeof state.date === "string" && typeof state.checkedAt === "string" &&
        state.report && typeof state.report === "object" && !Array.isArray(state.report)
      ? state as SecurityCheckState
      : undefined;
  } catch {
    return undefined;
  }
}

async function writeState(stateFile: string, state: SecurityCheckState): Promise<void> {
  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const temporaryFile = `${stateFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryFile, stateFile);
}

export function securityReferenceName(ref: string): string {
  return `refs/open-chat-code-mcp-security/${ref.replaceAll("/", "-")}`;
}

export async function checkSecurityUpdates(
  config: AppConfig,
  force = false,
  dryRun = false,
): Promise<Record<string, unknown>> {
  if (dryRun) {
    return {
      status: "dry_run",
      sourceUrl: config.securitySourceUrl,
      sourceRef: config.securitySourceRef,
      stateFile: config.securityCheckStateFile,
      action: "No network request or state update was made.",
    };
  }
  const today = localDateKey();
  const priorState = await readState(config.securityCheckStateFile);
  if (!force && priorState?.date === today) {
    return { ...priorState.report, status: "already_checked_today", checkedAt: priorState.checkedAt };
  }

  const securityRef = securityReferenceName(config.securitySourceRef);
  try {
    await git(config.appDirectory, [
      "fetch",
      "--quiet",
      "--no-tags",
      config.securitySourceUrl,
      `${config.securitySourceRef}:${securityRef}`,
    ]);
    const [localCommit, officialCommit, changedPaths] = await Promise.all([
      git(config.appDirectory, ["rev-parse", "HEAD"]),
      git(config.appDirectory, ["rev-parse", securityRef]),
      git(config.appDirectory, ["diff", "--name-only", "HEAD", securityRef, "--", ...SECURITY_PATHS]),
    ]);
    const files = changedPaths ? changedPaths.split("\n") : [];
    const securityReviewRequired = files.length > 0;
    const report: Record<string, unknown> = {
      status: securityReviewRequired ? "security_review_required" : "up_to_date",
      checkedAt: new Date().toISOString(),
      sourceUrl: config.securitySourceUrl,
      sourceRef: config.securitySourceRef,
      localCommit,
      officialCommit,
      securityReviewRequired,
      changedSecurityPaths: files,
      restartRecommended: securityReviewRequired,
      action: securityReviewRequired
        ? "Review and apply the official security changes to this installation, run tests and build, then restart the MCP service. Restarting alone does not apply code updates."
        : "No differences were found in the tracked security-sensitive paths. No restart is required for this check.",
    };
    await writeState(config.securityCheckStateFile, {
      date: today,
      checkedAt: String(report.checkedAt),
      report,
    });
    return report;
  } catch (error) {
    return {
      status: "check_failed",
      checkedAt: new Date().toISOString(),
      securityReviewRequired: true,
      restartRecommended: false,
      action: "The official security source could not be checked. Treat this installation as requiring security review until network access and MCP_SECURITY_SOURCE_URL can be verified.",
      detail: errorText(error),
    };
  }
}
