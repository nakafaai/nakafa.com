import { postHogPublicKeys, urlSchema } from "@repo/analytics/public";
import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/**
 * Validates the first-party PostHog proxy host, the managed reverse proxy that
 * both the browser and server reporting send events to. The browser reads the
 * same name through `@repo/analytics/public`, and the Worker binds it from here.
 */
export const postHogProxyKeys = () =>
  readEnvironment(
    { VITE_POSTHOG_PROXY_HOST: urlSchema },
    { VITE_POSTHOG_PROXY_HOST: process.env.VITE_POSTHOG_PROXY_HOST }
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
      TSS_PRERENDERING: optionalStringSchema,
      VERCEL_ENV: optionalStringSchema,
    },
    {
      TSS_PRERENDERING: process.env.TSS_PRERENDERING,
      VERCEL_ENV: process.env.VERCEL_ENV,
    }
  );
