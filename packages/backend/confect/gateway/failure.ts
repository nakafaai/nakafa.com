import { GatewayError } from "@ai-sdk/gateway";
import {
  AISDKError,
  APICallError,
  NoOutputGeneratedError,
  RetryError,
} from "ai";
import { Predicate, Schema } from "effect";

const RoutingFact = Schema.String.check(Schema.isMaxLength(128));

/**
 * One classification of every AI SDK and gateway error a model call can
 * raise. It carries routing facts only: never a message, cause, or payload.
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
    /** Seconds the gateway asked to wait before retrying, when it said. */
    retryAfter: Schema.optional(Schema.Finite),
    retryable: Schema.optional(Schema.Boolean),
    generation: Schema.optional(RoutingFact),
    /** The gateway's own error type, such as `rate_limit_exceeded`. */
    type: Schema.optional(RoutingFact),
  }
) {}
type Reason = GatewayFailure["reason"];

/** HTTP statuses with a reason of their own; any other 5xx is `unavailable`. */
const statusReasons: Partial<Record<number, Reason>> = {
  400: "invalid",
  401: "auth",
  402: "quota",
  403: "auth",
  404: "configuration",
  408: "timeout",
  413: "too-large",
  422: "invalid",
  424: "configuration",
  429: "rate-limit",
  504: "timeout",
};
const generationPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const envelopeDepth = 4;

/**
 * Unwraps RetryError and NoOutputGeneratedError, then classifies by SDK
 * class, name, and status.
 */
export function classify(cause: unknown): GatewayFailure {
  const error = unwrap(cause, 0);
  if (Schema.is(GatewayFailure)(error)) {
    return error;
  }
  if (GatewayError.isInstance(error)) {
    return new GatewayFailure({
      reason: statusReason(error.statusCode) ?? nameReason(error),
      status: error.statusCode,
      retryable: error.isRetryable,
      type: error.type,
      ...retryAfter(error.cause),
      ...generation(error.generationId),
    });
  }
  if (APICallError.isInstance(error)) {
    return new GatewayFailure({
      reason:
        error.statusCode === undefined
          ? "network"
          : (statusReason(error.statusCode) ?? nameReason(error)),
      retryable: error.isRetryable,
      ...(error.statusCode === undefined ? {} : { status: error.statusCode }),
      ...retryAfter(error),
    });
  }
  return new GatewayFailure({ reason: nameReason(error) });
}

/** Follows at most a few SDK envelopes instead of an unbounded cause chain. */
function unwrap(error: unknown, depth: number): unknown {
  if (depth === envelopeDepth) {
    return error;
  }
  if (RetryError.isInstance(error)) {
    return unwrap(error.lastError, depth + 1);
  }
  if (NoOutputGeneratedError.isInstance(error) && error.cause !== undefined) {
    return unwrap(error.cause, depth + 1);
  }
  return error;
}

function statusReason(status: number): Reason | undefined {
  return statusReasons[status] ?? (status >= 500 ? "unavailable" : undefined);
}

function nameReason(error: unknown): Reason {
  // AI SDK replaces GatewayAuthenticationError at its public model boundary.
  if (AISDKError.isInstance(error) && error.name === "GatewayError") {
    return "auth";
  }
  if (!Predicate.isError(error)) {
    return "unknown";
  }
  switch (error.name) {
    case "TimeoutError":
      return "timeout";
    case "AbortError":
      return "interrupted";
    case "GatewayAuthenticationError":
      return "auth";
    default:
      return "unknown";
  }
}

/** The seconds from the `retry-after` header of the HTTP response behind an error. */
function retryAfter(error: unknown) {
  const header = APICallError.isInstance(error)
    ? error.responseHeaders?.["retry-after"]
    : undefined;
  const seconds = Number.parseFloat(header ?? "");
  return Number.isFinite(seconds) && seconds >= 0
    ? { retryAfter: seconds }
    : {};
}

/** A gateway generation ID, kept only when it is a bounded plain identifier. */
function generation(id: string | undefined) {
  return id !== undefined && generationPattern.test(id)
    ? { generation: id }
    : {};
}
