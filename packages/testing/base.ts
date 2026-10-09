import path from "node:path";
import { defineConfig } from "vitest/config";

const config = defineConfig({
  resolve: {
    alias: {
      "@repo": path.resolve(import.meta.dirname, "../"),
    },
  },
  test: {
    globals: true,
    coverage: {
      enabled: true,
      provider: "istanbul",
      /** Every workspace gates each file at full coverage, and inherits this gate. */
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});

export default config;
