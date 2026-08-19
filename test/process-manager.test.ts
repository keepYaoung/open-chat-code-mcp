import { afterEach, describe, expect, it } from "vitest";

import { ProcessManager } from "../src/process-manager.js";

function createManager(): ProcessManager {
  return new ProcessManager({
    maxRetainedOutputBytes: 1024 * 1024,
    processRetentionMs: 60_000,
    maxProcesses: 16,
    defaultMaxOutputBytes: 1024 * 1024,
  });
}

describe("ProcessManager", () => {
  let manager: ProcessManager | undefined;

  afterEach(async () => {
    await manager?.shutdown();
  });

  it("captures stdout, stderr, and exit state", async () => {
    manager = createManager();
    const sessionId = manager.start({
      executable: "/bin/bash",
      args: ["-c", "printf stdout; printf stderr >&2"],
      commandForDisplay: "test output",
      cwd: process.cwd(),
    });

    await manager.waitForExit(sessionId, 2000);
    const result = await manager.read(sessionId);

    expect(result).toMatchObject({
      running: false,
      exitCode: 0,
      stdout: "stdout",
      stderr: "stderr",
      timedOut: false,
    });
    expect(result.output).toContain("stdout");
    expect(result.output).toContain("stderr");
  });

  it("supports interactive stdin and closes cleanly", async () => {
    manager = createManager();
    const sessionId = manager.start({
      executable: "/bin/cat",
      args: [],
      commandForDisplay: "cat",
      cwd: process.cwd(),
    });

    await manager.write(sessionId, "hello\n", true);
    await manager.waitForExit(sessionId, 2000);
    const result = await manager.read(sessionId);

    expect(result.running).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello\n");
  });

  it("terminates a command when its timeout expires", async () => {
    manager = createManager();
    const sessionId = manager.start({
      executable: "/bin/bash",
      args: ["-c", "sleep 10"],
      commandForDisplay: "sleep 10",
      cwd: process.cwd(),
      timeoutMs: 50,
    });

    await manager.waitForExit(sessionId, 3000);
    const result = await manager.read(sessionId);

    expect(result.running).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain("timeout");
  });
});
