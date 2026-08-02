import path from "node:path";
import { defineConfig } from "vitest/config";

const config = defineConfig({
  resolve: {
    alias: {
      "@repo": path.resolve(import.meta.dirname, "../"),
    },
  },
  test: {
    coverage: {
      enabled: true,
      provider: "istanbul",
    },
  },
});

export default config;
