import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

/**
 * Keep this config aligned with the shared Node Vitest baseline.
 * Do not weaken coverage or add app-local execution overrides here.
 */
export default mergeConfig(config, {
  resolve: {
    alias: {
      /** Match the app's `@/` import alias inside tests. */
      "@": import.meta.dirname,
    },
  },
  test: {
    coverage: {
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});
