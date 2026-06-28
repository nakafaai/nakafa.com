import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const postHogKeySchema = Schema.standardSchemaV1(
  Schema.String.pipe(Schema.startsWith("phc_"))
);
const urlSchema = Schema.standardSchemaV1(
  Schema.String.pipe(Schema.filter((value) => URL.canParse(value)))
);

/**
 * Validates the PostHog managed reverse proxy host read by Next config.
 */
export const postHogProxyKeys = () =>
  createEnv({
    server: {
      POSTHOG_PROXY_HOST: urlSchema,
    },
    runtimeEnv: {
      POSTHOG_PROXY_HOST: process.env.POSTHOG_PROXY_HOST,
    },
  });

/** Validates public PostHog values used by browser analytics. */
export const postHogPublicKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_POSTHOG_KEY: postHogKeySchema,
      NEXT_PUBLIC_POSTHOG_UI_HOST: urlSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    },
  });

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
    extends: [postHogProxyKeys(), postHogPublicKeys()],
    runtimeEnv: {},
  });
