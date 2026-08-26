import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { NAKAFA_EDGE_CLIENT_IP_HEADER } from "@repo/backend/agent/edge";
import { components } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, Schema } from "effect";

const MAX_CLIENT_ADDRESS_LENGTH = 256;

/** Nakafa policy: two reads per second with a bounded thirty-read burst. */
const agentRateLimiter = new RateLimiter(components.agentRateLimiter, {
  publicRead: {
    capacity: 30,
    kind: "token bucket",
    period: MINUTE,
    rate: 120,
  },
});

/** Expected public read quota exhaustion. */
export class AgentRateLimitError extends Schema.TaggedError<AgentRateLimitError>()(
  "AgentRateLimitError",
  {
    retryAfterMs: Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0))
    ),
  }
) {}

/** Consumes one per-client public read token through the Convex component. */
export const enforceAgentReadLimit = Effect.fn("agent.enforceReadLimit")(
  function* (ctx: ActionCtx, request: Request) {
    const key = yield* readClientKey(request);
    const status = yield* Effect.tryPromise({
      catch: (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message: "The public API quota boundary is unavailable.",
        }),
      try: () => agentRateLimiter.limit(ctx, "publicRead", { key }),
    });
    if (!status.ok) {
      return yield* new AgentRateLimitError({
        retryAfterMs: Math.max(0, status.retryAfter ?? 0),
      });
    }
  }
);

/** Derives a pseudonymous quota key from the trusted Vercel client address. */
const readClientKey = Effect.fn("agent.readClientKey")(function* (
  request: Request
) {
  const address = request.headers.get(NAKAFA_EDGE_CLIENT_IP_HEADER)?.trim();
  if (
    address === undefined ||
    address.length === 0 ||
    address.length > MAX_CLIENT_ADDRESS_LENGTH
  ) {
    return yield* new NakafaAgentDataReadError({
      message: "The public API quota identity is unavailable.",
    });
  }
  const digest = yield* Effect.tryPromise({
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "The public API quota identity is unavailable.",
      }),
    try: () =>
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(address)),
  });
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
});
