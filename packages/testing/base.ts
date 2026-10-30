import path from "node:path";
import { defineConfig } from "vitest/config";

const config = defineConfig({
  resolve: {
    alias: {
      "@repo": path.resolve(import.meta.dirname, "../"),
    },
  },
  test: {
    globals: true,
    /**
     * Vitest's module cache keeps each transform with its imports' resolved paths
     * and checks only the lockfile. A Bun install can link a package to another
     * copy of the same version without changing `bun.lock`, so a cached module
     * keeps importing the old copy, where a test's `vi.mock` of that package does
     * not reach (vitest-dev/vitest#11575). Without the cache, a run of `src/lib` in
     * `apps/www` takes the same time.
     */
    fsModuleCache: false,
    coverage: {
      enabled: true,
      provider: "istanbul",
      /** Every workspace gates each file at full coverage, and inherits this gate. */
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});

export default config;
