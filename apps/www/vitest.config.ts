import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "@repo/testing";
import { mergeConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Extend the shared frontend Vitest baseline with app-local aliases and setup. */
export default mergeConfig(config, {
  fileParallelism: false,
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
      clean: false,
      cleanOnRerun: false,
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});
