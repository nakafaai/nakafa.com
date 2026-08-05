import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

const defaultExcludes = ["**/node_modules/**", "coverage/**"];

export default mergeConfig(config, {
  test: {
    coverage: {
      reportsDirectory: "./coverage/agents",
      thresholds: {
        100: true,
        perFile: true,
      },
    },
    exclude: defaultExcludes,
    include: ["**/*.test.ts"],
    name: "agents",
  },
});
