import react from "@vitejs/plugin-react";
import { mergeConfig } from "vitest/config";
import config from "#testing/base";

export default mergeConfig(config, {
  css: {
    postcss: {
      /** Vitest stubs CSS imports; unit tests should not load app Tailwind. */
      plugins: [],
    },
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
