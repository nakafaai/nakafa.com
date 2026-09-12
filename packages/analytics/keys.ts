import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const postHogKeySchema = Schema.toStandardSchemaV1(
  Schema.String.check(Schema.isStartsWith("phc_"))
);
const urlSchema = Schema.toStandardSchemaV1(
  Schema.String.pipe(
    Schema.check(Schema.makeFilter((value) => URL.canParse(value)))
  )
);
const optionalSecretSchema = Schema.toStandardSchemaV1(
  Schema.UndefinedOr(Schema.Trimmed.check(Schema.isNonEmpty()))
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
/**
 * Validates the optional build-time credentials that authorize source map
 * upload. Both are absent outside production, so the Next config leaves upload
 * off rather than failing the build.
 *
 * References:
 * https://posthog.com/docs/error-tracking/upload-source-maps/nextjs
 */
export const postHogSourceMapKeys = () =>
  createEnv({
    server: {
      POSTHOG_API_KEY: optionalSecretSchema,
      POSTHOG_PROJECT_ID: optionalSecretSchema,
    },
    runtimeEnv: {
      POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
      POSTHOG_PROJECT_ID: process.env.POSTHOG_PROJECT_ID,
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
