import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig, type AppConfig } from "../src/config.js";
import { startHttpServer, type RunningHttpServer } from "../src/http-server.js";
import { createServices, type McpServices } from "../src/mcp-server.js";

describe("remote development MCP server", () => {
  let temporaryDirectory: string;
  let config: AppConfig;
  let services: McpServices;
  let running: RunningHttpServer;
  let endpoint: URL;

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "remote-dev-mcp-http-test-"));
    config = loadConfig(
      {
        MCP_AUTH_TOKEN: "integration-secret",
        MCP_HOST: "127.0.0.1",
        MCP_DEFAULT_CWD: temporaryDirectory,
        MCP_MAX_FILE_CHUNK_BYTES: "65536",
      },
      temporaryDirectory,
    );
    config.port = 0;
    services = createServices(config);
    running = await startHttpServer(config, services);
    const address = running.httpServer.address() as AddressInfo;
    endpoint = new URL(`http://127.0.0.1:${address.port}${config.endpoint}`);
  });

  afterAll(async () => {
    await running.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("rejects unauthenticated MCP initialization", async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });

    expect(response.status).toBe(401);
  });

  it("lists tools and executes script and file workflows", async () => {
    const client = new Client({ name: "integration-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(endpoint, {
      requestInit: {
        headers: { Authorization: "Bearer integration-secret" },
      },
    });
    await client.connect(transport);
    try {
      expect(client.getServerVersion()).toMatchObject({
        name: "cokacremote",
        version: "0.1.0",
      });
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "exec_command",
          "run_script",
          "write_stdin",
          "read_file",
          "write_file",
          "apply_patch",
          "upload_file",
          "download_file",
        ]),
      );

      const scriptResult = await client.callTool({
        name: "run_script",
        arguments: {
          runtime: "node",
          script: "console.log(6 * 7)",
          yieldTimeMs: 2000,
        },
      });
      expect(scriptResult.isError).not.toBe(true);
      expect(scriptResult.structuredContent).toMatchObject({
        completed: true,
        exitCode: 0,
        stdout: "42\n",
      });

      const writeResult = await client.callTool({
        name: "write_file",
        arguments: { path: "hello.txt", content: "hello MCP\n" },
      });
      expect(writeResult.isError).not.toBe(true);

      const readResult = await client.callTool({
        name: "read_file",
        arguments: { path: "hello.txt" },
      });
      expect(readResult.structuredContent).toMatchObject({
        content: "hello MCP\n",
        eof: true,
      });
    } finally {
      await transport.terminateSession();
      await client.close();
    }
  });
});
