import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "istanbul",
    },
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          coverage: {
            reportsDirectory: "./coverage/convex",
          },
          name: "convex",
          include: ["convex/**/*.test.ts"],
          exclude: ["**/node_modules/**", "coverage/**"],
          environment: "edge-runtime",
        },
      },
      {
        extends: true,
        test: {
          coverage: {
            reportsDirectory: "./coverage/backend",
          },
          name: "backend",
          include: ["**/*.test.ts"],
          exclude: ["convex/**", "**/node_modules/**", "coverage/**"],
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
