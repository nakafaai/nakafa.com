import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

const urlSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => URL.canParse(value), {
      message: "Expected a valid URL.",
    })
  )
);
/**
 * Defines the Convex URL required by Next.js server adapters such as
 * `convex/nextjs`. This module is browser-safe: it reads no server key.
 */
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
    { NEXT_PUBLIC_POLAR_SERVER: Schema.UndefinedOr(Schema.String) },
    { NEXT_PUBLIC_POLAR_SERVER: process.env.NEXT_PUBLIC_POLAR_SERVER }
  );
