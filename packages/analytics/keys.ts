import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const postHogKeySchema = Schema.toStandardSchemaV1(
  Schema.String.check(Schema.isStartingWith("phc_"))
);
const urlSchema = Schema.toStandardSchemaV1(
  Schema.String.pipe(
    Schema.check(Schema.makeFilter((value) => URL.canParse(value)))
  )
);
const optionalStringSchema = Schema.toStandardSchemaV1(
  Schema.UndefinedOr(Schema.String)
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
/**
 * Reads the deployment fields that decide whether server reporting runs. Both
 * accept any text, and this owner never validates the PostHog configuration.
 */
export const deploymentKeys = () =>
  createEnv({
    server: {
      NEXT_PHASE: optionalStringSchema,
      VERCEL_ENV: optionalStringSchema,
    },
    runtimeEnv: {
      NEXT_PHASE: process.env.NEXT_PHASE,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
  });
