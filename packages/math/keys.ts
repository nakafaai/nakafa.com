import { CAS_ENV } from "@repo/math/config";
import { createEnv } from "@t3-oss/env-core";
import { Schema } from "effect";

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
