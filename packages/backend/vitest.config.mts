import path from "node:path";
import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

const defaultExcludes = ["**/node_modules/**", "coverage/**"];

export default mergeConfig(config, {
  test: {
    coverage: {
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
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
