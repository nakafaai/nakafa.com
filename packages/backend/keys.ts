import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const urlSchema = Schema.toStandardSchemaV1(
  Schema.String.pipe(
    Schema.check(
      Schema.makeFilter((value) => URL.canParse(value), {
        message: "Expected a valid URL.",
      })
    )
  )
);
const stringSchema = Schema.toStandardSchemaV1(Schema.String);
const optionalStringSchema = Schema.toStandardSchemaV1(
  Schema.UndefinedOr(Schema.String)
);
/** Defines the Convex URL required by Next.js server adapters such as `convex/nextjs`. */
export const convexKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_CONVEX_URL: stringSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    },
  });
/** Defines the public Convex site URL used by auth and public HTTP adapters. */
export const convexSiteKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_CONVEX_SITE_URL: urlSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    },
  });
/** Reads the public Polar server selection. A missing or unknown value means sandbox. */
export const polarKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_POLAR_SERVER: optionalStringSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_POLAR_SERVER: process.env.NEXT_PUBLIC_POLAR_SERVER,
    },
  });
