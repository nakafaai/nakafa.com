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

export const keys = () =>
  createEnv({
    server: {
      ANALYZE: optionalStringSchema,
      // Added by Vercel
      NEXT_RUNTIME: Schema.standardSchemaV1(
        Schema.UndefinedOr(Schema.Literal("nodejs", "edge"))
      ),
      INTERNAL_CONTENT_API_KEY: requiredStringSchema,
    },
    client: {
      NEXT_PUBLIC_VERSION: requiredStringSchema,
      NEXT_PUBLIC_APP_URL: requiredUrlSchema,
      NEXT_PUBLIC_API_URL: optionalUrlSchema,
      NEXT_PUBLIC_MCP_URL: requiredUrlSchema,
    },
    runtimeEnv: {
      INTERNAL_CONTENT_API_KEY: process.env.INTERNAL_CONTENT_API_KEY,
      ANALYZE: process.env.ANALYZE,
      NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_MCP_URL: process.env.NEXT_PUBLIC_MCP_URL,
    },
  });
