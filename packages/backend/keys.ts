import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

const urlSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => URL.canParse(value), {
      message: "Expected a valid URL.",
    })
  )
);
const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/** Defines the Convex URL required by Next.js server adapters such as `convex/nextjs`. */
export const convexKeys = () =>
  readEnvironment(
    { NEXT_PUBLIC_CONVEX_URL: Schema.String },
    { NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL }
  );
/** Defines the public Convex site URL used by auth and public HTTP adapters. */
export const convexSiteKeys = () =>
  readEnvironment(
    { NEXT_PUBLIC_CONVEX_SITE_URL: urlSchema },
    { NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL }
  );
/** Reads the public Polar server selection. A missing or unknown value means sandbox. */
export const polarKeys = () =>
  readEnvironment(
    { NEXT_PUBLIC_POLAR_SERVER: optionalStringSchema },
    { NEXT_PUBLIC_POLAR_SERVER: process.env.NEXT_PUBLIC_POLAR_SERVER }
  );
/**
 * Reads the Agent Mode trust values that Convex and Next validate at module
 * startup. An empty string stays set here. Effect Config treats it as missing on
 * Convex, which would silently drop the agent key or fall back to another URL.
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
