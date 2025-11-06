import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "lcov"],
      provider: "v8",
    },
  },
  resolve: {
    alias: {
      "@": resolve(rootDir, "."),
    },
  },
});
