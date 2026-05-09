import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "istanbul",
      reportsDirectory: "./coverage",
      thresholds: {
        100: true,
        perFile: true,
      },
    },
    environment: "node",
    include: ["**/*.test.ts"],
    name: "math",
  },
  resolve: {
    alias: {
      "@repo": path.resolve(__dirname, "../"),
    },
  },
});

export default config;
