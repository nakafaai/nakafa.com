import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/**
 * Reads the Agent Mode trust values that Convex and Next validate at module
 * startup. Server code only: the browser reads `@repo/backend/public`. An empty
 * string stays set here. Effect Config treats it as missing on Convex, which
 * would silently drop the agent key or fall back to another URL.
 */
export const agentTrustKeys = () =>
  readEnvironment(
    {
      AKSARA_AGENT_SIGNING_KEY_ID: optionalStringSchema,
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: optionalStringSchema,
      CONVEX_CLOUD_URL: optionalStringSchema,
      NEXT_PUBLIC_CONVEX_URL: optionalStringSchema,
      VERCEL_ENV: optionalStringSchema,
    },
    {
      AKSARA_AGENT_SIGNING_KEY_ID: process.env.AKSARA_AGENT_SIGNING_KEY_ID,
      AKSARA_AGENT_SIGNING_PUBLIC_KEY:
        process.env.AKSARA_AGENT_SIGNING_PUBLIC_KEY,
      CONVEX_CLOUD_URL: process.env.CONVEX_CLOUD_URL,
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    }
  );
