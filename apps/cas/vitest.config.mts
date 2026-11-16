import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

export default mergeConfig(config, {
  resolve: {
    alias: [
      {
        find: /^@\//u,
        replacement: `${import.meta.dirname}/`,
      },
    ],
  },
  test: {
    coverage: {
      reportsDirectory: "./coverage",
    },
    include: ["front/**/*.test.ts"],
    name: "cas",
  },
});
