import path from "node:path";
import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./lib/__tests__/setup.ts"],
    coverage: {
      enabled: true,
      provider: "istanbul",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@repo": path.resolve(__dirname, "../../packages"),
    },
  },
});

export default config;
