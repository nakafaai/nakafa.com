import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

export default mergeConfig(config, {
  test: {
    coverage: {
      reportsDirectory: "./coverage",
      thresholds: {
        100: true,
        perFile: true,
      },
    },
    include: ["**/*.test.ts"],
    name: "math",
  },
});
