import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

export default mergeConfig(config, {
  test: {
    coverage: {
      reportsDirectory: "./coverage",
    },
    include: ["**/*.test.ts"],
    name: "math",
  },
});
