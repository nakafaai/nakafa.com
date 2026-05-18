import { Config } from "effect";

export const CAS_ENV = {
  apiKey: "MATH_CAS_API_KEY",
  url: "NEXT_PUBLIC_CAS_URL",
} as const;

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
