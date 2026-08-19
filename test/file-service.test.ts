import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileService } from "../src/file-service.js";

describe("FileService", () => {
  let temporaryDirectory: string;
  let files: FileService;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "remote-dev-mcp-test-"));
    files = new FileService({
      defaultCwd: temporaryDirectory,
      maxChunkBytes: 1024 * 1024,
      maxEditFileBytes: 1024 * 1024,
      maxOutputBytes: 1024 * 1024,
    });
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("writes, reads, lists, and replaces text", async () => {
    await files.writeFileContent(
      "src/example.txt",
      undefined,
      "alpha beta\n",
      "utf8",
      "overwrite",
      true,
    );
    await files.replaceInFile(
      "src/example.txt",
      undefined,
      "beta",
      "gamma",
      false,
      1,
    );

    const read = await files.readFileChunk(
      "src/example.txt",
      undefined,
      0,
      1024,
      "utf8",
    );
    const listed = await files.listDirectory(".", undefined, {
      recursive: true,
      includeMetadata: true,
    });

    expect(read.content).toBe("alpha gamma\n");
    expect(read.eof).toBe(true);
    expect(listed.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relativePath: path.join("src", "example.txt") }),
      ]),
    );
  });

  it("uploads and downloads binary chunks with offsets", async () => {
    const first = await files.uploadChunk(
      "artifact.bin",
      undefined,
      Buffer.from("hello").toString("base64"),
      0,
      true,
      true,
    );
    await files.uploadChunk(
      "artifact.bin",
      undefined,
      Buffer.from(" world").toString("base64"),
      first.nextOffset as number,
      false,
      true,
    );

    const downloaded = await files.downloadChunk(
      "artifact.bin",
      undefined,
      0,
      1024,
    );
    const hashed = await files.hashFile("artifact.bin", undefined, "sha256");

    expect(Buffer.from(downloaded.dataBase64 as string, "base64").toString()).toBe(
      "hello world",
    );
    expect(downloaded.eof).toBe(true);
    expect(hashed.digest).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("validates and applies a unified diff", async () => {
    await writeFile(path.join(temporaryDirectory, "patch.txt"), "old\n", "utf8");
    const patchText = [
      "diff --git a/patch.txt b/patch.txt",
      "--- a/patch.txt",
      "+++ b/patch.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");

    const checked = await files.applyPatch(patchText, undefined, {
      checkOnly: true,
      reverse: false,
      threeWay: false,
    });
    const applied = await files.applyPatch(patchText, undefined, {
      checkOnly: false,
      reverse: false,
      threeWay: false,
    });

    expect(checked.applied).toBe(false);
    expect(applied.applied).toBe(true);
    expect(await readFile(path.join(temporaryDirectory, "patch.txt"), "utf8")).toBe(
      "new\n",
    );
  });
});
