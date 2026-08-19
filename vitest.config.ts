import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["codex/**", "node_modules/**", "dist/**"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
