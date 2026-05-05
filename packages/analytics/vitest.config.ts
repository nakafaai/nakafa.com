import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = defineConfig({
  resolve: {
    alias: {
      "@repo": path.resolve(__dirname, "../"),
    },
  },
  test: {
    coverage: {
      enabled: true,
      provider: "istanbul",
      thresholds: {
        100: true,
        perFile: true,
      },
    },
    environment: "node",
  },
});

export default config;
