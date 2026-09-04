import path from "node:path";
import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

const defaultExcludes = ["**/node_modules/**", "coverage/**"];
const coverageExcludes = [
  "**/*.config.ts",
  "**/*.d.ts",
  "**/*.setup.ts",
  "**/*.test.ts",
  "**/_generated/**",
  "convex/**/schema.ts",
  "convex/crons.ts",
  "convex/http.ts",
  "convex/test.*.ts",
  "test/**",
];

export default mergeConfig(config, {
  test: {
    coverage: {
      changed: "origin/main",
      exclude: coverageExcludes,
      include: ["**/*.ts"],
      reportsDirectory: "./coverage",
      thresholds: {
        100: true,
        perFile: true,
      },
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
