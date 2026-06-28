import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const nodeEnvSchema = Schema.UndefinedOr(
  Schema.Literal("development", "production")
);

const booleanStringSchema = Schema.UndefinedOr(Schema.Literal("true", "false"));
const secretSchema = Schema.standardSchemaV1(Schema.NonEmptyTrimmedString);
const vercelEnvSchema = Schema.standardSchemaV1(
  Schema.UndefinedOr(Schema.Literal("development", "preview", "production"))
);

/**
 * Validates the AI Gateway environment contract at the provider seam.
 *
 * References:
 * - T3 Env Standard Schema support: https://env.t3.gg/docs/introduction
 * - Effect Standard Schema: https://effect.website/docs/schema/standard-schema/
 */
export const gatewayKeys = () =>
  createEnv({
    server: {
      AI_GATEWAY_API_KEY: secretSchema,
    },
    runtimeEnv: {
      AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    },
  });

/** Validates the optional AI SDK DevTools controls used by app-facing models. */
export const devtoolsKeys = () =>
  createEnv({
    server: {
      AI_SDK_DEVTOOLS: Schema.standardSchemaV1(booleanStringSchema),
      NODE_ENV: Schema.standardSchemaV1(nodeEnvSchema),
      VERCEL_ENV: vercelEnvSchema,
    },
    runtimeEnv: {
      AI_SDK_DEVTOOLS: process.env.AI_SDK_DEVTOOLS,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
  });

/** Validates the ElevenLabs environment contract where speech synthesis starts. */
export const elevenLabsKeys = () =>
  createEnv({
    server: {
      ELEVENLABS_API_KEY: secretSchema,
    },
    runtimeEnv: {
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    },
  });

/** Validates the Firecrawl environment contract where web search starts. */
export const firecrawlKeys = () =>
  createEnv({
    server: {
      FIRECRAWL_API_KEY: secretSchema,
    },
    runtimeEnv: {
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    },
  });

/** Validates the OpenWeather environment contract at the weather client seam. */
export const weatherKeys = () =>
  createEnv({
    server: {
      OPENWEATHER_API_KEY: secretSchema,
    },
    runtimeEnv: {
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    },
  });
