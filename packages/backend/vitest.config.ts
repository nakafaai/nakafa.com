import path from "node:path";
import { defineConfig } from "vitest/config";

const convexTestTimeout = 15_000;
const defaultExcludes = ["**/node_modules/**", "coverage/**"];
const backendRoot = process.cwd();

const config = defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "istanbul",
      reportsDirectory: "./coverage",
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
          exclude: ["convex/**", ...defaultExcludes],
          environment: "node",
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": backendRoot,
      "@repo": path.resolve(backendRoot, "../"),
    },
  },
});

export default config;
