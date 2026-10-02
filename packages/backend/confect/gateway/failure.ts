import { GatewayError } from "@ai-sdk/gateway";
import {
  AISDKError,
  APICallError,
  NoOutputGeneratedError,
  RetryError,
} from "ai";
import { Match, Number as Num, Option, Predicate, Schema } from "effect";

/** Seconds the gateway asked to wait before retrying. */
const Seconds = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
/** A gateway generation ID: a bounded plain identifier, never free text. */
const GenerationId = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9_-]{1,128}$/)
);

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
    retryAfter: Schema.optional(Seconds),
    retryable: Schema.optional(Schema.Boolean),
    generation: Schema.optional(GenerationId),
    /** The gateway's own error type, such as `rate_limit_exceeded`. */
    type: Schema.optional(Schema.String.check(Schema.isMaxLength(128))),
  }
) {}
type Reason = GatewayFailure["reason"];

/** Envelopes followed before classifying, instead of an unbounded cause chain. */
const ENVELOPE_DEPTH = 4;

/** The error an SDK envelope wraps: the last retry's error, or an empty output's cause. */
const wrapped = Match.type<unknown>().pipe(
  Match.when(RetryError.isInstance, ({ lastError }) => Option.some(lastError)),
  Match.when(NoOutputGeneratedError.isInstance, ({ cause }) =>
    Option.fromUndefinedOr(cause)
  ),
  Match.orElse(() => Option.none())
);

/** The error behind at most `ENVELOPE_DEPTH` SDK envelopes. */
function unwrap(error: unknown, depth: number): unknown {
  return depth === ENVELOPE_DEPTH
    ? error
    : Option.match(wrapped(error), {
        onNone: () => error,
        onSome: (inner) => unwrap(inner, depth + 1),
      });
}

/** The reason an HTTP status gives on its own; any other 5xx is `unavailable`. */
const statusReason = Match.type<number>().pipe(
  Match.withReturnType<Reason>(),
  Match.when(429, () => "rate-limit"),
  Match.when(402, () => "quota"),
  Match.when(Match.is(401, 403), () => "auth"),
  Match.when(Match.is(404, 424), () => "configuration"),
  Match.when(Match.is(400, 422), () => "invalid"),
  Match.when(413, () => "too-large"),
  Match.when(Match.is(408, 504), () => "timeout"),
  Match.when(Num.isGreaterThanOrEqualTo(500), () => "unavailable"),
  Match.option
);

/** The reason an error's name gives once its SDK class is gone. */
const namedReason = Match.type<string>().pipe(
  Match.withReturnType<Reason>(),
  Match.when("TimeoutError", () => "timeout"),
  Match.when("AbortError", () => "interrupted"),
  Match.when("GatewayAuthenticationError", () => "auth"),
  Match.orElse(() => "unknown")
);

/** The reason an error gives by its class or name when no HTTP status classifies it. */
const nameReason = Match.type<unknown>().pipe(
  Match.withReturnType<Reason>(),
  // AI SDK replaces GatewayAuthenticationError at its public model boundary.
  Match.when(
    (error: unknown) =>
      AISDKError.isInstance(error) && error.name === "GatewayError",
    () => "auth"
  ),
  Match.when(Predicate.isError, ({ name }) => namedReason(name)),
  Match.orElse(() => "unknown")
);

/** An HTTP failure's reason: by its status, or by its name when the status says nothing. */
function httpReason(status: number, error: unknown) {
  return Option.getOrElse(statusReason(status), () => nameReason(error));
}

/** The `retry-after` seconds of the HTTP response behind an error, when it sent usable ones. */
function retryAfter(error: unknown) {
  return Option.liftPredicate(error, APICallError.isInstance).pipe(
    Option.flatMapNullishOr(
      ({ responseHeaders }) => responseHeaders?.["retry-after"]
    ),
    Option.flatMap(Num.parse),
    Option.filter(Schema.is(Seconds)),
    Option.match({
      onNone: () => ({}),
      onSome: (seconds) => ({ retryAfter: seconds }),
    })
  );
}

/** A gateway generation ID, kept only when it is a bounded plain identifier. */
function generation(id: string | undefined) {
  return Option.fromUndefinedOr(id).pipe(
    Option.filter(Schema.is(GenerationId)),
    Option.match({
      onNone: () => ({}),
      onSome: (kept) => ({ generation: kept }),
    })
  );
}

/** Classifies an unwrapped error by its SDK class; a classified failure stays as it is. */
const failure = Match.type<unknown>().pipe(
  Match.withReturnType<GatewayFailure>(),
  Match.when(Schema.is(GatewayFailure), (classified) => classified),
  Match.when(
    GatewayError.isInstance,
    (error) =>
      new GatewayFailure({
        reason: httpReason(error.statusCode, error),
        status: error.statusCode,
        retryable: error.isRetryable,
        type: error.type,
        ...retryAfter(error.cause),
        ...generation(error.generationId),
      })
  ),
  Match.when(APICallError.isInstance, (error) =>
    Option.match(Option.fromUndefinedOr(error.statusCode), {
      // No HTTP status: the request never reached a server.
      onNone: () =>
        new GatewayFailure({
          reason: "network",
          retryable: error.isRetryable,
          ...retryAfter(error),
        }),
      onSome: (status) =>
        new GatewayFailure({
          reason: httpReason(status, error),
          status,
          retryable: error.isRetryable,
          ...retryAfter(error),
        }),
    })
  ),
  Match.orElse((error) => new GatewayFailure({ reason: nameReason(error) }))
);

/**
 * Unwraps RetryError and NoOutputGeneratedError, then classifies by SDK
 * class, name, and status.
 */
export function classify(cause: unknown): GatewayFailure {
  return failure(unwrap(cause, 0));
}
