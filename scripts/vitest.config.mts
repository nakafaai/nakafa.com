import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

export default mergeConfig(config, {
  test: {
    include: ["scripts/**/*.test.ts"],
    coverage: {
      include: ["scripts/**/*.ts"],
    },
  },
});
