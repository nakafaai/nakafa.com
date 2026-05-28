import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const convexTestTimeout = 15_000;
const confectTestTimeout = 20_000;
const defaultExcludes = ["**/node_modules/**", "coverage/**"];
const confectTests = ["confect/**/*.confect.test.ts"];

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
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          exclude: defaultExcludes,
          environment: "edge-runtime",
          testTimeout: convexTestTimeout,
        },
      },
      {
        extends: true,
        test: {
          name: "backend",
          include: ["**/*.test.ts"],
          exclude: ["convex/**", ...confectTests, ...defaultExcludes],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "confect",
          include: confectTests,
          environment: "node",
          testTimeout: confectTestTimeout,
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
