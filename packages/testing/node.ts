import { mergeConfig } from "vitest/config";
import config from "#testing/base";

export default mergeConfig(config, {
  test: {
    environment: "node",
  },
});
