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
 * Defines the Convex URL that browser code and the Convex client read. This
 * module is browser-safe: it reads no server key.
 */
export const convexKeys = () =>
  readEnvironment(
    { VITE_CONVEX_URL: Schema.String },
    { VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL }
  );
/** Defines the public Convex site URL used by auth and public HTTP adapters. */
export const convexSiteKeys = () =>
  readEnvironment(
    { VITE_CONVEX_SITE_URL: urlSchema },
    { VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL }
  );
