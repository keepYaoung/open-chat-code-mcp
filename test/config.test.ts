import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const appDirectory = "/workspace/app";
  const projectDirectory = "/workspace/project";
  const scopedEnvironment = {
    MCP_DEFAULT_CWD: projectDirectory,
    MCP_ALLOWED_PATHS: projectDirectory,
    MCP_MACOS_SANDBOX: "false",
  };

  it("requires authentication unless explicitly disabled", () => {
    expect(() => loadConfig({}, "/tmp")).toThrow("MCP_AUTH_TOKEN is required");
    expect(
      loadConfig(
        { ...scopedEnvironment, MCP_ALLOW_NO_AUTH: "true" },
        appDirectory,
      ).allowNoAuth,
    ).toBe(true);
  });

  it("requires scoped host settings", () => {
    expect(() =>
      loadConfig(
        {
          MCP_AUTH_TOKEN: "secret",
          MCP_DEFAULT_CWD: projectDirectory,
        },
        appDirectory,
      ),
    ).toThrow("MCP_ALLOWED_PATHS is required");

    const config = loadConfig(
      {
        ...scopedEnvironment,
        MCP_AUTH_TOKEN: "secret",
        MCP_PORT: "4321",
        MCP_ALLOWED_HOSTS: "mcp.example.com,localhost",
      },
      appDirectory,
    );

    expect(config).toMatchObject({
      host: "127.0.0.1",
      port: 4321,
      defaultCwd: projectDirectory,
      trustProxyHops: 0,
      authToken: "secret",
      allowedHosts: ["mcp.example.com", "localhost"],
    });
  });

  it("uses loopback binding and denies macOS home access by default", () => {
    const config = loadConfig(
      { ...scopedEnvironment, MCP_AUTH_TOKEN: "secret" },
      appDirectory,
    );
    expect(config).toMatchObject({
      host: "127.0.0.1",
      macosSandboxHomeAccess: "isolated",
    });
    expect(() =>
      loadConfig(
        {
          ...scopedEnvironment,
          MCP_AUTH_TOKEN: "secret",
          MCP_MACOS_SANDBOX_HOME_ACCESS: "all",
        },
        appDirectory,
      ),
    ).toThrow("MCP_MACOS_SANDBOX_HOME_ACCESS");
  });

  it("rejects partial integers and ports outside the valid range", () => {
    for (const value of ["3000oops", "3000.9", "70000"]) {
      expect(() =>
        loadConfig(
          {
            ...scopedEnvironment,
            MCP_AUTH_TOKEN: "secret",
            MCP_PORT: value,
          },
          appDirectory,
        ),
      ).toThrow("MCP_PORT must be an integer between 1 and 65535");
    }
    expect(
      loadConfig(
        {
          ...scopedEnvironment,
          MCP_AUTH_TOKEN: "secret",
          MCP_PORT: " 4321 ",
        },
        appDirectory,
      ).port,
    ).toBe(4321);
  });

  it("requires public HTTPS metadata when OAuth is enabled", () => {
    expect(() =>
      loadConfig(
        {
          ...scopedEnvironment,
          MCP_AUTH_TOKEN: "secret",
          MCP_OAUTH_ENABLED: "true",
        },
        appDirectory,
      ),
    ).toThrow("MCP_OAUTH_ISSUER is required");

    const config = loadConfig(
      {
        ...scopedEnvironment,
        MCP_AUTH_TOKEN: "secret",
        MCP_OAUTH_ENABLED: "true",
        MCP_PUBLIC_URL: "https://mcp.example.com",
        MCP_OAUTH_STATE_FILE: "/workspace/app/state/oauth-state.json",
      },
      appDirectory,
    );
    expect(config).toMatchObject({
      oauthEnabled: true,
      oauthApprovalKey: "secret",
      oauthIssuerUrl: "https://mcp.example.com/",
      oauthResourceUrl: "https://mcp.example.com/mcp",
      oauthStateFile: "/workspace/app/state/oauth-state.json",
    });
  });

  it("supports OAuth-only authentication with a separate approval key", () => {
    const config = loadConfig(
      {
        ...scopedEnvironment,
        MCP_OAUTH_ENABLED: "true",
        MCP_OAUTH_APPROVAL_KEY: "separate-oauth-approval-key",
        MCP_PUBLIC_URL: "https://mcp.example.com",
        MCP_TRUST_PROXY_HOPS: "1",
      },
      appDirectory,
    );

    expect(config).toMatchObject({
      authToken: undefined,
      oauthApprovalKey: "separate-oauth-approval-key",
      trustProxyHops: 1,
    });
    expect(() =>
      loadConfig(
        {
          ...scopedEnvironment,
          MCP_OAUTH_ENABLED: "true",
          MCP_PUBLIC_URL: "https://mcp.example.com",
        },
        appDirectory,
      ),
    ).toThrow("MCP_OAUTH_APPROVAL_KEY");
  });

  it("rejects unsafe proxy trust and OAuth URL settings", () => {
    expect(() =>
      loadConfig(
        {
          ...scopedEnvironment,
          MCP_AUTH_TOKEN: "secret",
          MCP_TRUST_PROXY_HOPS: "17",
        },
        appDirectory,
      ),
    ).toThrow("MCP_TRUST_PROXY_HOPS must be an integer between 0 and 16");
    expect(() =>
      loadConfig(
        {
          ...scopedEnvironment,
          MCP_AUTH_TOKEN: "secret",
          MCP_OAUTH_ENABLED: "true",
          MCP_OAUTH_ISSUER: "https://user:password@mcp.example.com",
          MCP_OAUTH_RESOURCE: "https://mcp.example.com/mcp",
        },
        appDirectory,
      ),
    ).toThrow("must not contain user credentials");
  });

  it("rejects broad or sensitive allowed path scopes", () => {
    const env = {
      MCP_AUTH_TOKEN: "secret",
      MCP_DEFAULT_CWD: "/Users/tester/Downloads",
      MCP_ALLOWED_PATHS: "/Users/tester/Downloads",
    };
    expect(() => loadConfig(env, "/srv/cokacremote")).toThrow(
      "specific project folders",
    );
    expect(() =>
      loadConfig(
        {
          MCP_AUTH_TOKEN: "secret",
          MCP_DEFAULT_CWD: "/Users/tester/.ssh",
          MCP_ALLOWED_PATHS: "/Users/tester/.ssh",
        },
        "/srv/cokacremote",
      ),
    ).toThrow("credential or tool state directories");
  });

  it("accepts specific project folders under broad personal folders", () => {
    const config = loadConfig(
      {
        MCP_AUTH_TOKEN: "secret",
        MCP_DEFAULT_CWD: "/Users/tester/Downloads/project-a",
        MCP_ALLOWED_PATHS: "/Users/tester/Downloads/project-a,/Users/tester/Downloads/project-b",
        MCP_OAUTH_STATE_FILE: "/srv/cokacremote/state/oauth-state.json",
      },
      "/srv/cokacremote",
    );

    expect(config.allowedPaths).toEqual([
      "/Users/tester/Downloads/project-a",
      "/Users/tester/Downloads/project-b",
    ]);
  });
});
