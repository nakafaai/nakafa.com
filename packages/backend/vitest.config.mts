import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

const defaultExcludes = ["**/node_modules/**", "coverage/**"];
const coverageExcludes = [
  "**/*.config.ts",
  "**/*.d.ts",
  "**/*.setup.ts",
  "**/*.test.ts",
  "**/_generated/**",
  "convex/**",
  "confect/**/schema.ts",
  "confect/tables/**",
  "confect/**/*.spec.ts",
  "components/betterAuth/schema.ts",
  "confect/crons.ts",
  "confect/http.ts",
  "confect/test.*.ts",
  "test/**",
  "vercel.ts",
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
          include: ["confect/**/*.test.ts", "components/**/*.test.ts"],
          exclude: defaultExcludes,
          environment: "edge-runtime",
          // The Convex AI gateway provider imports `convex/server`, which tests mock.
          server: { deps: { inline: ["@convex-dev/ai-sdk-provider"] } },
        },
      },
      {
        extends: true,
        test: {
          name: "backend",
          include: ["**/*.test.ts"],
          exclude: [
            "convex/**",
            "confect/**",
            "components/**",
            ...defaultExcludes,
          ],
          environment: "node",
        },
      },
    ],
  },
});
