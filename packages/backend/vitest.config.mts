import config from "@repo/testing/node";
import wasmModule from "vite-plugin-wasm-module";
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
  "confect/crons.ts",
  "confect/http.ts",
  "confect/test.*.ts",
  "test/**",
  // A declarative constant with no executable behavior to cover.
  "client/comments/list.ts",
];

export default mergeConfig(config, {
  test: {
    coverage: {
      changed: "origin/main",
      exclude: coverageExcludes,
      include: ["**/*.ts"],
      reportsDirectory: "./coverage",
    },
    // Keep CPU available for Convex Edge VMs when Turbo runs package tests together.
    maxWorkers: "50%",
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        // Loads each `.wasm` import as a `WebAssembly.Module`, as the Convex
        // bundler does, so Convex Auth's password hashing runs in the tests.
        plugins: [wasmModule()],
        test: {
          name: "convex",
          include: ["confect/**/*.test.ts", "components/**/*.test.ts"],
          exclude: defaultExcludes,
          environment: "edge-runtime",
          // The Convex AI gateway provider imports `convex/server`, which tests
          // mock, and `password-hash-wasm` is inlined so its `.wasm` import
          // reaches the plugin above.
          server: {
            deps: {
              inline: ["@convex-dev/ai-sdk-provider", "password-hash-wasm"],
            },
          },
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
