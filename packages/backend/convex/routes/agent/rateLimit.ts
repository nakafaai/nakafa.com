import {
  MINUTE,
  type RateLimitConfig,
  RateLimiter,
} from "@convex-dev/rate-limiter";
import {
  type AgentEdgeSurface,
  NAKAFA_EDGE_CLIENT_IP_HEADER,
} from "@repo/backend/agent/edge";
import { components } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/contents/_lib/agent/errors";
import { Effect, Schema } from "effect";

export const AGENT_RATE_LIMIT_MAX_REQUESTS = 120;
export const AGENT_RATE_LIMIT_PERIOD_MILLISECONDS = MINUTE;

const UNIDENTIFIED_EDGE_CLIENT = "unidentified-edge-client";
const AgentRateLimitKeySchema = Schema.String.check(
  Schema.isPattern(/^[\da-f]{64}$/u)
).pipe(Schema.brand("@Nakafa/AgentRateLimitKey"));
const EdgeClientIdentitySchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty()),
  Schema.check(Schema.isMaxLength(256))
);

export const AgentRateLimitDecisionSchema = Schema.Union([
  Schema.Struct({ allowed: Schema.Literal(true) }),
  Schema.Struct({
    allowed: Schema.Literal(false),
    retryAfterMilliseconds: Schema.Finite.check(Schema.isGreaterThan(0)),
  }),
]);
export type AgentRateLimitDecision = typeof AgentRateLimitDecisionSchema.Type;

export class AgentRateLimitUnavailableError extends Schema.TaggedError<AgentRateLimitUnavailableError>()(
  "AgentRateLimitUnavailableError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}

export const AGENT_RATE_LIMIT_CONFIG = {
  kind: "fixed window",
  period: AGENT_RATE_LIMIT_PERIOD_MILLISECONDS,
  rate: AGENT_RATE_LIMIT_MAX_REQUESTS,
} satisfies RateLimitConfig;

const rateLimiter = new RateLimiter(components.rateLimiter, {
  publicApi: AGENT_RATE_LIMIT_CONFIG,
  publicMcp: AGENT_RATE_LIMIT_CONFIG,
});

/** Consumes one bounded request from the client-specific public quota. */
export const limitAgentRequest = Effect.fn("agent.limitRequest")(function* (
  ctx: ActionCtx,
  request: Request,
  surface: AgentEdgeSurface
) {
  const key = yield* deriveAgentRateLimitKey(request);
  const status = yield* Effect.tryPromise({
    catch: (error) =>
      new AgentRateLimitUnavailableError({
        cause: getUnknownErrorMessage(error),
        message: "The public request limiter is unavailable.",
      }),
    try: () => rateLimiter.limit(ctx, getAgentRateLimitName(surface), { key }),
  });

  return yield* Schema.decodeEffect(AgentRateLimitDecisionSchema)(
    status.ok
      ? { allowed: true }
      : {
          allowed: false,
          retryAfterMilliseconds: Math.max(1, status.retryAfter),
        }
  ).pipe(
    Effect.mapError(
      (error) =>
        new AgentRateLimitUnavailableError({
          cause: error.message,
          message: "The public request limiter returned an invalid result.",
        })
    )
  );
});

/** Resolves the component key owned by one public edge surface. */
export function getAgentRateLimitName(surface: AgentEdgeSurface) {
  if (surface === "api") {
    return "publicApi";
  }
  return "publicMcp";
}

/** Derives a stable pseudonymous key without storing the raw client IP. */
export const deriveAgentRateLimitKey = Effect.fn("agent.deriveRateLimitKey")(
  function* (request: Request) {
    const source = request.headers.get(NAKAFA_EDGE_CLIENT_IP_HEADER);
    const identity = source
      ? yield* Schema.decodeEffect(EdgeClientIdentitySchema)(source).pipe(
          Effect.mapError(
            (error) =>
              new AgentRateLimitUnavailableError({
                cause: error.message,
                message: "The edge client identity is invalid.",
              })
          )
        )
      : UNIDENTIFIED_EDGE_CLIENT;
    const digest = yield* Effect.tryPromise({
      catch: (error) =>
        new AgentRateLimitUnavailableError({
          cause: getUnknownErrorMessage(error),
          message: "The edge client identity could not be protected.",
        }),
      try: () =>
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)),
    });
    const hexadecimal = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    return yield* Schema.decodeEffect(AgentRateLimitKeySchema)(
      hexadecimal
    ).pipe(
      Effect.mapError(
        (error) =>
          new AgentRateLimitUnavailableError({
            cause: error.message,
            message: "The edge client identity digest is invalid.",
          })
      )
    );
  }
);
