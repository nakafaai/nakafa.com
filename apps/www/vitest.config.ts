import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "@repo/testing";
import { mergeConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(config, {
  resolve: {
    alias: {
      "@": __dirname,
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
