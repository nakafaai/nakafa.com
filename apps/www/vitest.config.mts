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
    alias: [
      /** The scripts folder sits beside src, so its tests keep the `@/` alias to it. */
      {
        find: /^@\/scripts\//u,
        replacement: `${import.meta.dirname}/scripts/`,
      },
      { find: /^@\/e2e\//u, replacement: `${import.meta.dirname}/e2e/` },
      { find: /^@\/public\//u, replacement: `${import.meta.dirname}/public/` },
      /** Match the app's `@/` import alias inside tests. */
      { find: /^@\//u, replacement: `${import.meta.dirname}/src/` },
    ],
  },
  test: {
    /** Production AFDocs checks run only against an already-started site. */
    exclude: [...configDefaults.exclude, "checks/afdocs.test.ts"],
    /** Prepare the React test environment before each suite loads. */
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      /** Client lazy boundaries are verified by analyzer and browser gates. */
      exclude: ["src/lib/content/renderer/client/**"],
    },
  },
});
