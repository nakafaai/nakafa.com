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
      reportsDirectory: "./coverage",
    },
    // Keep CPU available for Convex Edge VMs when Turbo runs package tests together.
    maxWorkers: "50%",
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          exclude: defaultExcludes,
          environment: "edge-runtime",
        },
      },
      {
        extends: true,
        test: {
          name: "backend",
          include: ["**/*.test.ts"],
          exclude: ["convex/**", ...defaultExcludes],
          environment: "node",
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@repo": path.resolve(__dirname, "../"),
    },
  },
});

export default config;
