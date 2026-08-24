import { defineConfig } from "vitest/config";

/** Runs the scheduled contract against Nakafa's public production hosts. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["agent-surface.check.ts"],
  },
});
