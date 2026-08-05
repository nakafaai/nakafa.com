import path from "node:path";
import config from "@repo/testing/react";
import { mergeConfig } from "vitest/config";

export default mergeConfig(config, {
  test: {
    coverage: {
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
