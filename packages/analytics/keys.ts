import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

/**
 * Validate the shared PostHog environment contract used by browser and server
 * analytics.
 *
 * References:
 * https://posthog.com/docs/libraries/next-js
 * https://posthog.com/docs/libraries/node
 * https://posthog.com/docs/advanced/proxy/managed-reverse-proxy
 */
export const keys = () =>
  createEnv({
    server: {
      POSTHOG_PROXY_HOST: z.url(),
    },
    client: {
      NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_"),
      NEXT_PUBLIC_POSTHOG_UI_HOST: z.url(),
    },
    runtimeEnv: {
      POSTHOG_PROXY_HOST: process.env.POSTHOG_PROXY_HOST,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    },
  });
