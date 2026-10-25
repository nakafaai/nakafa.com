import { urlSchema } from "@repo/backend/public";
import { readEnvironment } from "@repo/utilities/env";
import { deployStageKeys } from "@repo/utilities/stage";
import { Schema } from "effect";

const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/**
 * Reads the Agent Mode trust values that Convex and Start validate at module
 * startup. Server code only: the browser reads `@repo/backend/public`. An empty
 * string stays set here. Effect Config treats it as missing on Convex, which
 * would silently drop the agent key or fall back to another URL.
 */
export const agentTrustKeys = () => ({
  ...deployStageKeys(),
  ...readEnvironment(
    {
      AKSARA_AGENT_SIGNING_KEY_ID: optionalStringSchema,
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: optionalStringSchema,
      CONVEX_CLOUD_URL: optionalStringSchema,
      VITE_CONVEX_URL: optionalStringSchema,
    },
    {
      AKSARA_AGENT_SIGNING_KEY_ID: process.env.AKSARA_AGENT_SIGNING_KEY_ID,
      AKSARA_AGENT_SIGNING_PUBLIC_KEY:
        process.env.AKSARA_AGENT_SIGNING_PUBLIC_KEY,
      CONVEX_CLOUD_URL: process.env.CONVEX_CLOUD_URL,
      VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
    }
  ),
});
/**
 * Reads the Convex site address that server code calls for Better Auth, the
 * session and the token routes. The browser reads the same public name through
 * `@repo/backend/public`, so the Worker binds this key with the other server values.
 */
export const convexSiteServerKeys = () =>
  readEnvironment(
    { VITE_CONVEX_SITE_URL: urlSchema },
    { VITE_CONVEX_SITE_URL: process.env.VITE_CONVEX_SITE_URL }
  );
