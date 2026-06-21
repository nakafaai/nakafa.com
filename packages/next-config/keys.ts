import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const optionalStringSchema = Schema.standardSchemaV1(
  Schema.UndefinedOr(Schema.String)
);
const requiredStringSchema = Schema.standardSchemaV1(Schema.String);
const optionalUrlSchema = Schema.standardSchemaV1(
  Schema.UndefinedOr(
    Schema.String.pipe(
      Schema.filter((value) => URL.canParse(value), {
        message: () => "Expected a valid URL.",
      })
    )
  )
);
const requiredUrlSchema = Schema.standardSchemaV1(
  Schema.String.pipe(
    Schema.filter((value) => URL.canParse(value), {
      message: () => "Expected a valid URL.",
    })
  )
);

/** Defines the optional bundle-analyzer flag read by Next config files. */
export const analyzeKeys = () =>
  createEnv({
    server: {
      ANALYZE: optionalStringSchema,
    },
    runtimeEnv: {
      ANALYZE: process.env.ANALYZE,
    },
  });

/** Defines the internal content API secret shared by app-to-app cache calls. */
export const contentApiKeys = () =>
  createEnv({
    server: {
      INTERNAL_CONTENT_API_KEY: requiredStringSchema,
    },
    runtimeEnv: {
      INTERNAL_CONTENT_API_KEY: process.env.INTERNAL_CONTENT_API_KEY,
    },
  });

/** Defines the canonical site URL used by server-side absolute URL builders. */
export const siteUrlKeys = () =>
  createEnv({
    server: {
      SITE_URL: requiredUrlSchema,
    },
    runtimeEnv: {
      SITE_URL: process.env.SITE_URL,
    },
  });

/** Defines the public MCP endpoint used by app and MCP surfaces. */
export const mcpKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_MCP_URL: requiredUrlSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_MCP_URL: process.env.NEXT_PUBLIC_MCP_URL,
    },
  });

/** Defines public app URL values shared by Next applications. */
export const publicAppKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_VERSION: requiredStringSchema,
      NEXT_PUBLIC_APP_URL: requiredUrlSchema,
      NEXT_PUBLIC_API_URL: optionalUrlSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    },
  });

export const keys = () =>
  createEnv({
    extends: [analyzeKeys(), contentApiKeys(), publicAppKeys(), mcpKeys()],
    server: {
      // Added by Vercel
      NEXT_RUNTIME: Schema.standardSchemaV1(
        Schema.UndefinedOr(Schema.Literal("nodejs", "edge"))
      ),
    },
    runtimeEnv: {
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    },
  });
