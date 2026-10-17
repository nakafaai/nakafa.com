import { Schema } from "effect";

/** Seconds the gateway asked to wait before retrying. */
export const Seconds = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
/** The gateway's own error type or code: a bounded plain identifier, never free text. */
export const GatewayType = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_.-]{1,128}$/)
);

/** The deployment cannot call the gateway, such as a free, local, or self-hosted deployment. */
export class GatewayConfigurationError extends Schema.TaggedError<GatewayConfigurationError>()(
  "GatewayConfigurationError",
  {
    message: Schema.String,
  }
) {}

/**
 * One classification of every error a model call can raise. It carries
 * routing facts only: never a message, cause, or payload.
 */
export class GatewayFailure extends Schema.TaggedError<GatewayFailure>()(
  "GatewayFailure",
  {
    reason: Schema.Literals([
      "rate-limit",
      "quota",
      "auth",
      "configuration",
      "invalid",
      "too-large",
      "timeout",
      "unavailable",
      "network",
      "interrupted",
      "unknown",
    ]),
    status: Schema.optional(Schema.Finite),
    retryAfter: Schema.optional(Seconds),
    retryable: Schema.optional(Schema.Boolean),
    /**
     * The error's documented type, such as `invalid_request_error`. Named
     * failures such as `unsupported_parameter` are its code, which is read only
     * when the body names no type.
     */
    type: Schema.optional(GatewayType),
  }
) {}
