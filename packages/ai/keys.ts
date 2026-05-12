import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const nodeEnvSchema = Schema.UndefinedOr(
  Schema.Literal("development", "production")
);

const booleanStringSchema = Schema.UndefinedOr(Schema.Literal("true", "false"));
const secretSchema = Schema.standardSchemaV1(Schema.NonEmptyTrimmedString);

/**
 * Validates AI package environment variables through Standard Schema.
 *
 * References:
 * - T3 Env Standard Schema support: https://env.t3.gg/docs/introduction
 * - Effect Standard Schema: https://effect.website/docs/schema/standard-schema/
 */
export const keys = () =>
  createEnv({
    server: {
      AI_GATEWAY_API_KEY: secretSchema,
      AI_SDK_DEVTOOLS: Schema.standardSchemaV1(booleanStringSchema),
      ELEVENLABS_API_KEY: secretSchema,
      FIRECRAWL_API_KEY: secretSchema,
      NODE_ENV: Schema.standardSchemaV1(nodeEnvSchema),
      OPENWEATHER_API_KEY: secretSchema,
    },
    runtimeEnv: {
      AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
      AI_SDK_DEVTOOLS: process.env.AI_SDK_DEVTOOLS,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    },
  });
