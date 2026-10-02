import { Config, Effect, Redacted, Schema, String as Str } from "effect";

export class GatewayConfigurationError extends Schema.TaggedError<GatewayConfigurationError>()(
  "GatewayConfigurationError",
  {
    message: Schema.String,
  }
) {}

const unconfigured = () =>
  new GatewayConfigurationError({ message: "AI Gateway is not configured." });

/** The deployment's AI Gateway key; a missing or blank key fails before any request. */
export const apiKey = Config.Redacted("AI_GATEWAY_API_KEY").pipe(
  Effect.mapError(unconfigured),
  Effect.filterOrFail(
    (key) => Str.isNonEmpty(Str.trim(Redacted.value(key))),
    unconfigured
  )
);

/** App attribution the gateway shows with every request from Nakafa. */
export const headers = {
  "http-referer": "https://nakafa.com",
  "x-title": "nakafa.com",
};
