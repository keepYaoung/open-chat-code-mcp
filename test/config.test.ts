import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("requires authentication unless explicitly disabled", () => {
    expect(() => loadConfig({}, "/tmp")).toThrow("MCP_AUTH_TOKEN is required");
    expect(loadConfig({ MCP_ALLOW_NO_AUTH: "true" }, "/tmp").allowNoAuth).toBe(true);
  });

  it("loads full-access host settings", () => {
    const config = loadConfig(
      {
        MCP_AUTH_TOKEN: "secret",
        MCP_PORT: "4321",
        MCP_DEFAULT_CWD: "/",
        MCP_ALLOWED_HOSTS: "mcp.example.com,localhost",
      },
      "/tmp",
    );

    expect(config).toMatchObject({
      port: 4321,
      defaultCwd: "/",
      authToken: "secret",
      allowedHosts: ["mcp.example.com", "localhost"],
    });
  });

  it("requires public HTTPS metadata when OAuth is enabled", () => {
    expect(() =>
      loadConfig({ MCP_AUTH_TOKEN: "secret", MCP_OAUTH_ENABLED: "true" }, "/tmp"),
    ).toThrow("MCP_OAUTH_ISSUER is required");

    const config = loadConfig(
      {
        MCP_AUTH_TOKEN: "secret",
        MCP_OAUTH_ENABLED: "true",
        MCP_PUBLIC_URL: "https://mcp.example.com",
        MCP_OAUTH_STATE_FILE: "/tmp/oauth-state.json",
      },
      "/tmp",
    );
    expect(config).toMatchObject({
      oauthEnabled: true,
      oauthIssuerUrl: "https://mcp.example.com/",
      oauthResourceUrl: "https://mcp.example.com/mcp",
      oauthStateFile: "/tmp/oauth-state.json",
    });
  });
});
