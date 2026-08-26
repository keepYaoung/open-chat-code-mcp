import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { createMacosSandboxProfile } from "../src/macos-sandbox.js";

describe("createMacosSandboxProfile", () => {
  const home = "/Users/example";
  const project = "/workspace/project";

  function profile(homeAccess: "none" | "read" | "read-write"): string {
    return createMacosSandboxProfile(
      loadConfig(
        {
          MCP_AUTH_TOKEN: "test-secret",
          MCP_DEFAULT_CWD: project,
          MCP_ALLOWED_PATHS: project,
          MCP_MACOS_SANDBOX_HOME_ACCESS: homeAccess,
        },
        "/workspace/app",
      ),
      home,
    );
  }

  it("does not grant whole-home access by default", () => {
    const sandboxProfile = profile("none");
    expect(sandboxProfile).not.toContain(`subpath \"${home}\"`);
    expect(sandboxProfile).toContain(`subpath \"${project}\"`);
  });

  it("requires an explicit setting for full-home access", () => {
    const readProfile = profile("read");
    const readWriteProfile = profile("read-write");
    const readWriteRules = readProfile.slice(readProfile.indexOf("(allow file-write*"));
    const readWriteHomeRules = readWriteProfile.slice(
      readWriteProfile.indexOf("(allow file-write*"),
    );
    expect(readProfile).toContain(`subpath \"${home}\"`);
    expect(readWriteRules).not.toContain(home);
    expect(readWriteHomeRules).toContain(`subpath \"${home}\"`);
  });
});
