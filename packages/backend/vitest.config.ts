import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const convexTestTimeout = 15_000;
const defaultExcludes = ["**/node_modules/**", "coverage/**"];

const config = defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          coverage: {
            enabled: true,
            provider: "istanbul",
            reportsDirectory: "./coverage/convex",
          },
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
          coverage: {
            enabled: true,
            provider: "istanbul",
            reportsDirectory: "./coverage/backend",
          },
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
