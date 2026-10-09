import { postHogPublicKeys, urlSchema } from "@repo/analytics/public";
import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/**
 * Validates the PostHog managed reverse proxy host read by Next config. Server
 * code only: the browser reads `@repo/analytics/public`.
 */
export const postHogProxyKeys = () =>
  readEnvironment(
    { POSTHOG_PROXY_HOST: urlSchema },
    { POSTHOG_PROXY_HOST: process.env.POSTHOG_PROXY_HOST }
  );
/**
 * Validate the shared PostHog environment contract used by server analytics.
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
