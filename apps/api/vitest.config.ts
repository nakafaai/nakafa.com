import path from "node:path";
import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./lib/test-setup.ts"],
    coverage: {
      enabled: true,
      provider: "istanbul",
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
      "@repo": path.resolve(import.meta.dirname, "../../packages"),
    },
  },
});

export default config;
