import path from "node:path";
import config from "@repo/testing/react";
import { configDefaults, mergeConfig } from "vitest/config";

/**
 * Keep this config aligned with the shared frontend Vitest baseline.
 * Browser-like tests use the shared jsdom default. Node-only tests declare
 * `// @vitest-environment node` in the test file so ownership stays local.
 *
 * @see https://vitest.dev/guide/environment
 * @see https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser
 */
export default mergeConfig(config, {
  resolve: {
    alias: {
      /** Match the app's `@/` import alias inside tests. */
      "@": import.meta.dirname,
      /** Replace Next's import guard with one shared server-test boundary. */
      "server-only": path.resolve(import.meta.dirname, "./test/server-only.ts"),
    },
  },
  test: {
    /** Production AFDocs checks run only against an already-started site. */
    exclude: [...configDefaults.exclude, "checks/afdocs.test.ts"],
    /** Prepare the React test environment before each suite loads. */
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      /** Client lazy boundaries are verified by analyzer and browser gates. */
      exclude: ["lib/content/renderer/client/**"],
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});
