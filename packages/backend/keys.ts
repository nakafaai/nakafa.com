import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const urlSchema = Schema.standardSchemaV1(
  Schema.String.pipe(
    Schema.filter((value) => URL.canParse(value), {
      message: () => "Expected a valid URL.",
    })
  )
);
const secretSchema = Schema.standardSchemaV1(Schema.NonEmptyTrimmedString);
const stringSchema = Schema.standardSchemaV1(Schema.String);

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

export const keys = () =>
  createEnv({
    extends: [convexKeys()],
    server: {
      CONVEX_URL: stringSchema,
      CONVEX_SITE_URL: urlSchema,
      SITE_URL: urlSchema,
      AUTH_GOOGLE_ID: secretSchema,
      AUTH_GOOGLE_SECRET: secretSchema,
      POLAR_ACCESS_TOKEN: secretSchema,
      POLAR_WEBHOOK_SECRET: secretSchema,
      BETTER_AUTH_SECRET: secretSchema,
      INTERNAL_CONTENT_API_KEY: secretSchema,
    },
    client: {
      NEXT_PUBLIC_CONVEX_SITE_URL: urlSchema,
      NEXT_PUBLIC_POLAR_SERVER: Schema.standardSchemaV1(
        Schema.Literal("production", "sandbox")
      ),
    },
    runtimeEnv: {
      CONVEX_URL: process.env.CONVEX_URL,
      CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
      SITE_URL: process.env.SITE_URL,
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
      POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
      POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
      NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
      NEXT_PUBLIC_POLAR_SERVER: process.env.NEXT_PUBLIC_POLAR_SERVER,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      INTERNAL_CONTENT_API_KEY: process.env.INTERNAL_CONTENT_API_KEY,
    },
  });
