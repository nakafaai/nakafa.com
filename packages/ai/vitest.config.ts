import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultExcludes = ["**/node_modules/**", "coverage/**"];

const config = defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "istanbul",
      reportsDirectory: "./coverage/agents",
      thresholds: {
        100: true,
        perFile: true,
      },
    },
    environment: "node",
    exclude: defaultExcludes,
    include: ["**/*.test.ts"],
    name: "agents",
  },
  resolve: {
    alias: {
      "@repo": path.resolve(__dirname, "../"),
    },
  },
});

export default config;
