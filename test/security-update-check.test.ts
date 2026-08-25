import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { checkSecurityUpdates } from "../src/security-update-check.js";

const execFile = promisify(execFileCallback);
const temporaryDirectories: string[] = [];

async function git(directory: string, args: string[]): Promise<void> {
  await execFile("git", ["-C", directory, ...args]);
}

afterAll(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("checkSecurityUpdates", () => {
  it("compares against an explicit official source without depending on fork remote names", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cokacremote-security-check-"));
    temporaryDirectories.push(root);
    const official = path.join(root, "official");
    const fork = path.join(root, "fork");
    await mkdir(path.join(official, "src"), { recursive: true });
    await git(root, ["init", "--initial-branch=main", official]);
    await git(official, ["config", "user.email", "test@example.com"]);
    await git(official, ["config", "user.name", "Test User"]);
    await writeFile(path.join(official, "src", "auth.ts"), "export const secure = true;\n");
    await git(official, ["add", "."]);
    await git(official, ["commit", "-m", "initial"]);
    await execFile("git", ["clone", "--quiet", official, fork]);

    await writeFile(path.join(official, "src", "auth.ts"), "export const secure = false;\n");
    await git(official, ["add", "."]);
    await git(official, ["commit", "-m", "security: update auth boundary"]);

    const config = loadConfig(
      {
        MCP_AUTH_TOKEN: "test-secret",
        MCP_DEFAULT_CWD: fork,
        MCP_SECURITY_SOURCE_URL: official,
        MCP_SECURITY_CHECK_STATE_FILE: path.join(root, "state", "security-check.json"),
      },
      fork,
    );
    const report = await checkSecurityUpdates(config);
    expect(report).toMatchObject({
      status: "security_review_required",
      securityReviewRequired: true,
      restartRecommended: true,
      changedSecurityPaths: ["src/auth.ts"],
    });

    expect(await checkSecurityUpdates(config)).toMatchObject({
      status: "already_checked_today",
      securityReviewRequired: true,
    });
  });
});
