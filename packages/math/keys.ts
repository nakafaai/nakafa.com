import { createEnv } from "@t3-oss/env-core";
import { Config, Schema } from "effect";

const CAS_ENV = {
  apiKey: "MATH_CAS_API_KEY",
  url: "MATH_CAS_URL",
} as const;

const casUrlSchema = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter((value) => URL.canParse(value), {
    message: () => "Expected a valid CAS URL.",
  })
);

/**
 * Validate the CAS environment contract for runtimes that consume deterministic
 * math.
 *
 * References:
 * - T3 Env Core: https://env.t3.gg/docs/core
 * - Vercel env vars: https://vercel.com/docs/environment-variables
 */
export const keys = () =>
  createEnv({
    emptyStringAsUndefined: true,
    runtimeEnvStrict: {
      [CAS_ENV.apiKey]: process.env[CAS_ENV.apiKey],
      [CAS_ENV.url]: process.env[CAS_ENV.url],
    },
    server: {
      [CAS_ENV.apiKey]: Schema.standardSchemaV1(Schema.NonEmptyTrimmedString),
      [CAS_ENV.url]: Schema.standardSchemaV1(casUrlSchema),
    },
  });

/**
 * Type-safe CAS environment config consumed by the Effect math service.
 *
 * References:
 * - Effect Config: https://effect.website/docs/configuration/
 * - Effect Redacted: https://effect.website/docs/data-types/redacted/
 */
export const casUrl = Config.string(CAS_ENV.url);

/**
 * Redacted CAS bearer token so logs and errors do not expose secrets.
 *
 * References:
 * - Effect Config: https://effect.website/docs/configuration/
 * - Effect Redacted: https://effect.website/docs/data-types/redacted/
 */
export const casApiKey = Config.redacted(CAS_ENV.apiKey);
