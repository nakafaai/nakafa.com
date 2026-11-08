import { defineConfig } from "vitest/config";

/** Runs AFDocs against an already-started production site. */
export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    environment: "node",
    include: ["checks/afdocs.test.ts"],
  },
});
