import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import { securityHeaders } from "@repo/site";
import { AGENT_DISCOVERY_HEADERS } from "@repo/site/discovery";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

/**
 * The PostHog proxy origin that the build names. Without one, no proxy route is
 * installed, so analytics requests never leave the app for an unset provider.
 */
const POSTHOG_PROXY_ORIGIN = process.env.POSTHOG_PROXY_HOST;

/** Every response carries the security headers and the agent discovery links. */
const SHARED_HEADERS = Object.fromEntries(
  [...securityHeaders, ...AGENT_DISCOVERY_HEADERS].map(({ key, value }) => [
    key,
    value,
  ])
);

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
        ...(POSTHOG_PROXY_ORIGIN === undefined
          ? {}
          : {
              [`${POSTHOG_PROXY_PATH}/**`]: {
                proxy: `${POSTHOG_PROXY_ORIGIN}/**`,
              },
            }),
        "/**": { headers: SHARED_HEADERS },
      },
      vercel: { skewProtection: false },
    }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
