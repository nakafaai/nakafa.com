import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import { securityHeaders } from "@repo/site";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

/** The PostHog proxy origin: the production proxy unless the build names another. */
const POSTHOG_PROXY_ORIGIN =
  process.env.POSTHOG_PROXY_HOST ?? "https://t.nakafa.com";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: "app",
      importProtection: { behavior: { dev: "error", build: "error" } },
    }),
    // Decision 14: no skew route (__vdpl). Server-function calls carry the
    // pinned deployment through Start's client fetch seam instead.
    nitro({
      routeRules: {
        [`${POSTHOG_PROXY_PATH}/**`]: {
          proxy: `${POSTHOG_PROXY_ORIGIN}/**`,
        },
        "/**": {
          headers: Object.fromEntries(
            securityHeaders.map(({ key, value }) => [key, value])
          ),
        },
      },
      vercel: { skewProtection: false },
    }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
