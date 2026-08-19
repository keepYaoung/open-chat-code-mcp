import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { errorMessage } from "./errors.js";

const OUTPUT_CHUNK_BYTES = 16 * 1024;

export type ProcessOutputStream = "stdout" | "stderr";

interface OutputChunk {
  seq: number;
  stream: ProcessOutputStream;
  data: Buffer;
}

interface ManagedProcess {
  sessionId: string;
  child: ChildProcessWithoutNullStreams;
  command: string;
  cwd: string;
  startedAt: number;
  endedAt: number | undefined;
  exitCode: number | null | undefined;
  signal: NodeJS.Signals | null | undefined;
  error: string | undefined;
  timedOut: boolean;
  chunks: OutputChunk[];
  retainedBytes: number;
  totalOutputBytes: number;
  droppedOutputBytes: number;
  nextSeq: number;
  waiters: Set<() => void>;
  exitWaiters: Set<() => void>;
  timeoutHandle: NodeJS.Timeout | undefined;
  cleanup: (() => Promise<void>) | undefined;
}

export interface StartProcessRequest {
  executable: string;
  args: string[];
  commandForDisplay: string;
  cwd: string;
  env?: Record<string, string> | undefined;
  timeoutMs?: number | undefined;
  stdin?: string | undefined;
  cleanup?: (() => Promise<void>) | undefined;
}

export interface ReadProcessRequest {
  afterSeq?: number | undefined;
  waitMs?: number | undefined;
  maxOutputBytes?: number | undefined;
}

export interface ProcessReadResult {
  sessionId: string;
  command: string;
  cwd: string;
  running: boolean;
  pid: number | undefined;
  startedAt: string;
  endedAt: string | undefined;
  wallTimeMs: number;
  exitCode: number | null | undefined;
  signal: NodeJS.Signals | null | undefined;
  timedOut: boolean;
  error: string | undefined;
  stdout: string;
  stderr: string;
  output: string;
  nextSeq: number;
  hasMore: boolean;
  totalOutputBytes: number;
  droppedOutputBytes: number;
}

export interface ProcessManagerOptions {
  maxRetainedOutputBytes: number;
  processRetentionMs: number;
  maxProcesses: number;
  defaultMaxOutputBytes: number;
}

export class ProcessManager {
  readonly #processes = new Map<string, ManagedProcess>();
  readonly #options: ProcessManagerOptions;

  constructor(options: ProcessManagerOptions) {
    this.#options = options;
  }

  start(request: StartProcessRequest): string {
    this.prune();
    this.#makeCapacity();

    const child = spawn(request.executable, request.args, {
      cwd: request.cwd,
      env: { ...process.env, ...request.env },
      stdio: "pipe",
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    const sessionId = randomUUID();
    const managed: ManagedProcess = {
      sessionId,
      child,
      command: request.commandForDisplay,
      cwd: request.cwd,
      startedAt: Date.now(),
      endedAt: undefined,
      exitCode: undefined,
      signal: undefined,
      error: undefined,
      timedOut: false,
      chunks: [],
      retainedBytes: 0,
      totalOutputBytes: 0,
      droppedOutputBytes: 0,
      nextSeq: 1,
      waiters: new Set(),
      exitWaiters: new Set(),
      timeoutHandle: undefined,
      cleanup: request.cleanup,
    };
    this.#processes.set(sessionId, managed);

    child.stdout.on("data", (data: Buffer | string) => {
      this.#appendOutput(managed, "stdout", Buffer.from(data));
    });
    child.stderr.on("data", (data: Buffer | string) => {
      this.#appendOutput(managed, "stderr", Buffer.from(data));
    });
    child.on("error", (error) => {
      managed.error = errorMessage(error);
      this.#finish(managed, null, null);
    });
    child.on("close", (code, signal) => {
      this.#finish(managed, code, signal);
    });

    const timeoutMs = request.timeoutMs ?? 0;
    if (timeoutMs > 0) {
      managed.timeoutHandle = setTimeout(() => {
        managed.timedOut = true;
        managed.error ??= `Process exceeded timeout of ${timeoutMs} ms`;
        this.#signal(managed, "SIGTERM");
        const forceTimer = setTimeout(() => {
          if (this.#isRunning(managed)) {
            this.#signal(managed, "SIGKILL");
          }
        }, 5000);
        forceTimer.unref();
      }, timeoutMs);
      managed.timeoutHandle.unref();
    }

    if (request.stdin !== undefined && request.stdin.length > 0) {
      child.stdin.write(request.stdin);
    }
    return sessionId;
  }

  async read(
    sessionId: string,
    request: ReadProcessRequest = {},
  ): Promise<ProcessReadResult> {
    const managed = this.#require(sessionId);
    const afterSeq = Math.max(0, request.afterSeq ?? 0);
    const waitMs = Math.max(0, request.waitMs ?? 0);
    if (waitMs > 0) {
      await this.#waitForOutput(managed, afterSeq, waitMs);
    }

    const maxOutputBytes = Math.max(
      OUTPUT_CHUNK_BYTES,
      Math.min(
        request.maxOutputBytes ?? this.#options.defaultMaxOutputBytes,
        this.#options.defaultMaxOutputBytes,
      ),
    );
    const eligible = managed.chunks.filter((chunk) => chunk.seq > afterSeq);
    const selected: OutputChunk[] = [];
    let selectedBytes = 0;
    for (const chunk of eligible) {
      if (selectedBytes + chunk.data.length > maxOutputBytes) {
        break;
      }
      selected.push(chunk);
      selectedBytes += chunk.data.length;
    }

    const stdout = Buffer.concat(
      selected.filter((chunk) => chunk.stream === "stdout").map((chunk) => chunk.data),
    ).toString("utf8");
    const stderr = Buffer.concat(
      selected.filter((chunk) => chunk.stream === "stderr").map((chunk) => chunk.data),
    ).toString("utf8");
    const output = Buffer.concat(selected.map((chunk) => chunk.data)).toString("utf8");
    const nextSeq = selected.at(-1)?.seq ?? afterSeq;
    const now = managed.endedAt ?? Date.now();

    return {
      sessionId,
      command: managed.command,
      cwd: managed.cwd,
      running: this.#isRunning(managed),
      pid: managed.child.pid,
      startedAt: new Date(managed.startedAt).toISOString(),
      endedAt:
        managed.endedAt === undefined
          ? undefined
          : new Date(managed.endedAt).toISOString(),
      wallTimeMs: now - managed.startedAt,
      exitCode: managed.exitCode,
      signal: managed.signal,
      timedOut: managed.timedOut,
      error: managed.error,
      stdout,
      stderr,
      output,
      nextSeq,
      hasMore: eligible.length > selected.length,
      totalOutputBytes: managed.totalOutputBytes,
      droppedOutputBytes: managed.droppedOutputBytes,
    };
  }

  async write(
    sessionId: string,
    input: string,
    closeStdin = false,
  ): Promise<void> {
    const managed = this.#require(sessionId);
    if (input.length === 0 && !closeStdin) {
      return;
    }
    if (!this.#isRunning(managed)) {
      throw new Error(`Process ${sessionId} is not running`);
    }
    if (managed.child.stdin.destroyed || !managed.child.stdin.writable) {
      throw new Error(`stdin is closed for process ${sessionId}`);
    }

    if (input.length > 0) {
      await new Promise<void>((resolve, reject) => {
        managed.child.stdin.write(input, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    if (closeStdin) {
      managed.child.stdin.end();
    }
  }

  async waitForExit(sessionId: string, waitMs: number): Promise<void> {
    const managed = this.#require(sessionId);
    if (!this.#isRunning(managed) || waitMs <= 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        managed.exitWaiters.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, waitMs);
      managed.exitWaiters.add(finish);
      if (!this.#isRunning(managed)) {
        finish();
      }
    });
  }

  async terminate(
    sessionId: string,
    signal: NodeJS.Signals = "SIGTERM",
    graceMs = 3000,
  ): Promise<ProcessReadResult> {
    const managed = this.#require(sessionId);
    if (this.#isRunning(managed)) {
      this.#signal(managed, signal);
      if (signal !== "SIGKILL" && graceMs > 0) {
        const forceTimer = setTimeout(() => {
          if (this.#isRunning(managed)) {
            this.#signal(managed, "SIGKILL");
          }
        }, graceMs);
        forceTimer.unref();
      }
    }
    return this.read(sessionId, { waitMs: Math.min(graceMs, 1000) });
  }

  list(): Array<{
    sessionId: string;
    pid: number | undefined;
    command: string;
    cwd: string;
    running: boolean;
    startedAt: string;
    endedAt: string | undefined;
    exitCode: number | null | undefined;
  }> {
    this.prune();
    return [...this.#processes.values()].map((managed) => ({
      sessionId: managed.sessionId,
      pid: managed.child.pid,
      command: managed.command,
      cwd: managed.cwd,
      running: this.#isRunning(managed),
      startedAt: new Date(managed.startedAt).toISOString(),
      endedAt:
        managed.endedAt === undefined
          ? undefined
          : new Date(managed.endedAt).toISOString(),
      exitCode: managed.exitCode,
    }));
  }

  prune(): void {
    const cutoff = Date.now() - this.#options.processRetentionMs;
    for (const [sessionId, managed] of this.#processes) {
      if (managed.endedAt !== undefined && managed.endedAt < cutoff) {
        this.#processes.delete(sessionId);
      }
    }
  }

  async shutdown(): Promise<void> {
    const running = [...this.#processes.values()].filter((managed) =>
      this.#isRunning(managed),
    );
    for (const managed of running) {
      this.#signal(managed, "SIGTERM");
    }
    await new Promise((resolve) => setTimeout(resolve, running.length > 0 ? 500 : 0));
    for (const managed of running) {
      if (this.#isRunning(managed)) {
        this.#signal(managed, "SIGKILL");
      }
    }
  }

  #makeCapacity(): void {
    if (this.#processes.size < this.#options.maxProcesses) {
      return;
    }
    const completed = [...this.#processes.values()]
      .filter((managed) => managed.endedAt !== undefined)
      .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
    while (
      this.#processes.size >= this.#options.maxProcesses &&
      completed.length > 0
    ) {
      const managed = completed.shift();
      if (managed) {
        this.#processes.delete(managed.sessionId);
      }
    }
    if (this.#processes.size >= this.#options.maxProcesses) {
      throw new Error(
        `Maximum managed process count (${this.#options.maxProcesses}) reached`,
      );
    }
  }

  #require(sessionId: string): ManagedProcess {
    const managed = this.#processes.get(sessionId);
    if (!managed) {
      throw new Error(`Unknown process session: ${sessionId}`);
    }
    return managed;
  }

  #appendOutput(
    managed: ManagedProcess,
    stream: ProcessOutputStream,
    data: Buffer,
  ): void {
    for (let offset = 0; offset < data.length; offset += OUTPUT_CHUNK_BYTES) {
      const chunkData = Buffer.from(data.subarray(offset, offset + OUTPUT_CHUNK_BYTES));
      managed.chunks.push({
        seq: managed.nextSeq,
        stream,
        data: chunkData,
      });
      managed.nextSeq += 1;
      managed.retainedBytes += chunkData.length;
      managed.totalOutputBytes += chunkData.length;
    }
    while (
      managed.retainedBytes > this.#options.maxRetainedOutputBytes &&
      managed.chunks.length > 0
    ) {
      const removed = managed.chunks.shift();
      if (removed) {
        managed.retainedBytes -= removed.data.length;
        managed.droppedOutputBytes += removed.data.length;
      }
    }
    this.#notify(managed);
  }

  #finish(
    managed: ManagedProcess,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    if (managed.endedAt !== undefined) {
      return;
    }
    managed.endedAt = Date.now();
    managed.exitCode = code;
    managed.signal = signal;
    if (managed.timeoutHandle) {
      clearTimeout(managed.timeoutHandle);
      managed.timeoutHandle = undefined;
    }
    this.#notify(managed);
    const exitWaiters = [...managed.exitWaiters];
    managed.exitWaiters.clear();
    for (const waiter of exitWaiters) {
      waiter();
    }
    if (managed.cleanup) {
      void managed.cleanup().catch((error) => {
        managed.error ??= `Cleanup failed: ${errorMessage(error)}`;
      });
    }
  }

  #notify(managed: ManagedProcess): void {
    const waiters = [...managed.waiters];
    managed.waiters.clear();
    for (const waiter of waiters) {
      waiter();
    }
  }

  #waitForOutput(
    managed: ManagedProcess,
    afterSeq: number,
    waitMs: number,
  ): Promise<void> {
    if (managed.nextSeq - 1 > afterSeq || !this.#isRunning(managed)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        managed.waiters.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, waitMs);
      managed.waiters.add(finish);
      if (managed.nextSeq - 1 > afterSeq || !this.#isRunning(managed)) {
        finish();
      }
    });
  }

  #isRunning(managed: ManagedProcess): boolean {
    return managed.endedAt === undefined;
  }

  #signal(managed: ManagedProcess, signal: NodeJS.Signals): void {
    const pid = managed.child.pid;
    if (pid === undefined) {
      return;
    }
    try {
      if (process.platform !== "win32") {
        process.kill(-pid, signal);
      } else {
        managed.child.kill(signal);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ESRCH") {
        managed.error ??= `Failed to signal process: ${errorMessage(error)}`;
      }
    }
  }
}
