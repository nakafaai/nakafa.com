import { APICallError, NoOutputGeneratedError, RetryError } from "ai";
import { Match, Number as Num, Option, Predicate, Schema } from "effect";

/** Seconds the gateway asked to wait before retrying. */
const Seconds = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
/** The gateway's own error type or code: a bounded plain identifier, never free text. */
const GatewayType = Schema.String.check(Schema.isMaxLength(128));

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
    /** The gateway's own error type, such as `invalid_request_error`, or its code when the body names no type. */
    type: Schema.optional(GatewayType),
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
  Match.orElse(() => "unknown")
);

/** The reason an error gives by its name when no HTTP status classifies it. */
const nameReason = Match.type<unknown>().pipe(
  Match.withReturnType<Reason>(),
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

/** The gateway's error body. Only its type and code are read; its message and parameters never are. */
const ErrorBody = Schema.Struct({
  error: Schema.Struct({
    type: Schema.optionalKey(Schema.NullOr(Schema.String)),
    code: Schema.optionalKey(
      Schema.NullOr(Schema.Union([Schema.String, Schema.Finite]))
    ),
  }),
});

/** The gateway's error type: its `error.type`, or its string `error.code` when the body names no type. */
function gatewayType(data: unknown) {
  return Option.match(Schema.decodeUnknownOption(ErrorBody)(data), {
    onNone: () => ({}),
    onSome: ({ error: { type, code } }) => {
      const named = type ?? (typeof code === "string" ? code : undefined);
      return Schema.is(GatewayType)(named) ? { type: named } : {};
    },
  });
}

/** Classifies an SDK API call error by its status; no status means no response arrived. */
const failure = Match.type<unknown>().pipe(
  Match.withReturnType<GatewayFailure>(),
  Match.when(Schema.is(GatewayFailure), (classified) => classified),
  Match.when(APICallError.isInstance, (error) =>
    Option.match(Option.fromUndefinedOr(error.statusCode), {
      // No HTTP status: the request never reached a server.
      onNone: () =>
        new GatewayFailure({
          reason: "network",
          retryable: error.isRetryable,
          ...retryAfter(error),
          ...gatewayType(error.data),
        }),
      onSome: (status) =>
        new GatewayFailure({
          reason: httpReason(status, error),
          status,
          retryable: error.isRetryable,
          ...retryAfter(error),
          ...gatewayType(error.data),
        }),
    })
  ),
  Match.orElse((error) => new GatewayFailure({ reason: nameReason(error) }))
);

/**
 * Unwraps RetryError and NoOutputGeneratedError around the failure behind
 * them, then classifies by SDK class, name, and status.
 */
export function classify(cause: unknown): GatewayFailure {
  return failure(unwrap(cause, 0));
}
