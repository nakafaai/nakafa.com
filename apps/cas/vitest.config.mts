import { fileURLToPath } from "node:url";
import config from "@repo/testing/node";
import { mergeConfig } from "vitest/config";

export default mergeConfig(config, {
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./", import.meta.url)),
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
