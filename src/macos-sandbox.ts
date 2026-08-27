import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AppConfig } from "./config.js";

const TOOLCHAIN_READ_PATHS = [
  "/bin",
  "/usr/bin",
  "/private/etc/ssl",
  "/private/var/select",
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

function isInside(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function createMacosSandboxProfile(config: AppConfig, homeDirectory: string): string {
  const allowedProjectPaths = uniquePaths(config.allowedPaths ?? [config.defaultCwd]);
  const readExecPaths = [
    ...allowedProjectPaths,
    os.tmpdir(),
    ...TOOLCHAIN_READ_PATHS,
  ];
  const writablePaths = [
    ...allowedProjectPaths,
    os.tmpdir(),
  ];

  const isolatedHome = isInside(config.appDirectory, homeDirectory);
  // Only the deployment template's app-owned HOME is admitted automatically.
  if (
    config.macosSandboxHomeAccess === "isolated" &&
    isolatedHome
  ) {
    readExecPaths.push(homeDirectory);
    writablePaths.push(homeDirectory);
  }
  // Broader home access must always be requested explicitly.
  if (config.macosSandboxHomeAccess === "read" || config.macosSandboxHomeAccess === "read-write") {
    readExecPaths.push(homeDirectory);
  }
  if (config.macosSandboxHomeAccess === "read-write") {
    writablePaths.push(homeDirectory);
  }

  return [
    "(version 1)",
    "(deny default)",
    '(import "system.sb")',
    "",
    "(allow signal (target self))",
    "(allow process-exec process-fork process-info*)",
    "(allow network-inbound network-outbound)",
    "(allow file-read* file-map-executable",
    ...profileLineForPaths("subpath", uniquePaths(readExecPaths)),
    ")",
    "(allow process-exec",
    ...profileLineForPaths("subpath", readExecPaths),
    ")",
    "(allow file-write*",
    ...profileLineForPaths("subpath", uniquePaths(writablePaths)),
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
  await writeFile(profilePath, createMacosSandboxProfile(config, homeDirectory), "utf8");

  return {
    executable: "/usr/bin/sandbox-exec",
    args: ["-f", profilePath, executable, ...args],
    cleanup: async () => {
      await rm(temporaryDirectory, { recursive: true, force: true });
    },
  };
}
