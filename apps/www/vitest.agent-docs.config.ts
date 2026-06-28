import { defineConfig } from "vitest/config";

/**
 * Runs AFDocs as an external site check against an already started app.
 *
 * Normal `www` tests keep using `vitest.config.ts` with coverage thresholds;
 * this config only makes the dedicated AFDocs check discoverable.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["agent-docs.check.ts"],
  },
});
