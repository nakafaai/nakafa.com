import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "@repo/testing";
import { mergeConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeTestFiles = [
  "app/api/**/*.test.ts",
  "app/mcp/**/*.test.ts",
  "lib/llms/**/*.test.ts",
  "lib/sitemap/**/*.test.ts",
  "lib/utils/seo/**/*.test.ts",
  "scripts/**/*.test.ts",
];
const jsdomTestFiles = [
  "__tests__/**/*.test.ts",
  "components/**/*.test.ts",
  "lib/auth/**/*.test.ts",
  "lib/store/**/*.test.ts",
  "lib/utils/__tests__/**/*.test.ts",
];

/**
 * Keep this config aligned with the shared frontend Vitest baseline.
 * Vitest 4 removed environmentMatchGlobs; projects are the documented
 * way to keep Node-only tests out of jsdom's browser-compatible module graph.
 *
 * @see https://vitest.dev/guide/projects
 * @see https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility
 */
export default mergeConfig(config, {
  resolve: {
    alias: {
      /** Match the app's `@/` import alias inside tests. */
      "@": __dirname,
    },
  },
  test: {
    /** Prepare the React test environment before each suite loads. */
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          include: nodeTestFiles,
          name: "node",
          setupFiles: [],
        },
      },
      {
        extends: true,
        test: {
          environment: "jsdom",
          include: jsdomTestFiles,
          name: "jsdom",
        },
      },
    ],
    coverage: {
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});
