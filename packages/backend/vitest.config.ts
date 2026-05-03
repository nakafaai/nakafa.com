import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const convexSerialTestPattern = "convex/**/*.serial.test.ts";
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
          exclude: [convexSerialTestPattern, ...defaultExcludes],
          environment: "edge-runtime",
        },
      },
      {
        extends: true,
        test: {
          coverage: {
            enabled: true,
            provider: "istanbul",
            reportsDirectory: "./coverage/convex",
          },
          // convex-test runs delayed scheduled work through timers. Keep the
          // scheduler-heavy IRT suite isolated so other Convex files stay fast.
          fileParallelism: false,
          name: "convex-serial",
          include: [convexSerialTestPattern],
          exclude: defaultExcludes,
          environment: "edge-runtime",
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
