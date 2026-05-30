import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = defineConfig({
  css: {
    postcss: {
      /** Vitest stubs CSS imports; unit tests should not load app Tailwind. */
      plugins: [],
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      enabled: true,
      provider: "istanbul",
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@repo": path.resolve(__dirname, "../"),
    },
  },
});

export default config;
