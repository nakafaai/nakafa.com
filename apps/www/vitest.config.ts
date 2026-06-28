import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "@repo/testing";
import { mergeConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      "@": __dirname,
    },
  },
  test: {
    /** Prepare the React test environment before each suite loads. */
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});
