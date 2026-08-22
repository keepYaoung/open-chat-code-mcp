import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AppConfig } from "./config.js";

const TOOLCHAIN_READ_PATHS = [
  "/opt/homebrew",
  "/usr/local",
  "/Library/Developer",
  "/Applications/Xcode.app",
];

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((entry) => path.resolve(entry)))];
}

function profileLineForPaths(rule: string, paths: string[]): string[] {
  return paths.map((entry) => `  (${rule} "${entry}")`);
}

function createProfile(config: AppConfig, homeDirectory: string): string {
  const allowedProjectPaths = uniquePaths(config.allowedPaths ?? [config.defaultCwd]);
  const readExecPaths = uniquePaths([
    ...allowedProjectPaths,
    homeDirectory,
    os.tmpdir(),
    ...TOOLCHAIN_READ_PATHS,
  ]);
  const writablePaths = uniquePaths([
    ...allowedProjectPaths,
    homeDirectory,
    os.tmpdir(),
  ]);

  return [
    "(version 1)",
    "(deny default)",
    '(import "system.sb")',
    "",
    "(allow signal (target self))",
    "(allow process-exec process-fork process-info*)",
    "(allow network-inbound network-outbound)",
    "(allow file-read* file-map-executable",
    ...profileLineForPaths("subpath", readExecPaths),
    ")",
    "(allow process-exec",
    ...profileLineForPaths("subpath", readExecPaths),
    ")",
    "(allow file-write*",
    ...profileLineForPaths("subpath", writablePaths),
    ")",
    "",
  ].join("\n");
}

export interface SandboxWrappedCommand {
  executable: string;
  args: string[];
  cleanup: () => Promise<void>;
}

export async function maybeWrapWithMacosSandbox(
  config: AppConfig,
  executable: string,
  args: string[],
): Promise<SandboxWrappedCommand> {
  if (!(config.macosSandbox && process.platform === "darwin")) {
    return {
      executable,
      args,
      cleanup: async () => undefined,
    };
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "cokacremote-sandbox-"));
  const profilePath = path.join(temporaryDirectory, "command.sb");
  const homeDirectory = path.resolve(process.env.HOME || os.homedir());
  await writeFile(profilePath, createProfile(config, homeDirectory), "utf8");

  return {
    executable: "/usr/bin/sandbox-exec",
    args: ["-f", profilePath, executable, ...args],
    cleanup: async () => {
      await rm(temporaryDirectory, { recursive: true, force: true });
    },
  };
}
