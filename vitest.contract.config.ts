import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** The data-layer contract tests: they run against the local test stack (tests/support/local-stack), never a remote service. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/contract/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    setupFiles: ["tests/contract/setup.ts"],
  },
});
