import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

const postHogKeySchema = Schema.String.check(Schema.isStartingWith("phc_"));
const urlSchema = Schema.String.pipe(
  Schema.check(Schema.makeFilter((value) => URL.canParse(value)))
);
const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/**
 * Validates the PostHog managed reverse proxy host read by Next config. Server
 * code only: the browser never reads this key.
 */
export const postHogProxyKeys = () =>
  readEnvironment(
    { POSTHOG_PROXY_HOST: urlSchema },
    { POSTHOG_PROXY_HOST: process.env.POSTHOG_PROXY_HOST }
  );
/** Validates public PostHog values used by browser analytics. */
export const postHogPublicKeys = () =>
  readEnvironment(
    {
      NEXT_PUBLIC_POSTHOG_KEY: postHogKeySchema,
      NEXT_PUBLIC_POSTHOG_UI_HOST: urlSchema,
    },
    {
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    }
  );
/**
 * Validate the shared PostHog environment contract used by server analytics.
 * The browser reads `postHogPublicKeys` instead, so it never reads a server key.
 *
 * References:
 * https://posthog.com/docs/libraries/next-js
 * https://posthog.com/docs/libraries/node
 * https://posthog.com/docs/advanced/proxy/managed-reverse-proxy
 */
export const keys = () => ({
  ...postHogProxyKeys(),
  ...postHogPublicKeys(),
});
/**
 * Reads the deployment fields that decide whether server reporting runs. Both
 * accept any text, and this owner never validates the PostHog configuration.
 */
export const deploymentKeys = () =>
  readEnvironment(
    {
      NEXT_PHASE: optionalStringSchema,
      VERCEL_ENV: optionalStringSchema,
    },
    {
      NEXT_PHASE: process.env.NEXT_PHASE,
      VERCEL_ENV: process.env.VERCEL_ENV,
    }
  );
