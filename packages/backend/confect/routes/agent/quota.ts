import { Schema } from "effect";

/**
 * The public read quota of one client: a token bucket that holds 30 reads and
 * refills 120 a minute. The limiter and the RateLimit policy both read it, so
 * the policy never names a quota the limiter does not apply.
 */
export const PUBLIC_READ_QUOTA = {
  capacity: 30,
  name: "public-read",
  ratePerMinute: 120,
} as const;

/** The seconds an empty bucket takes to fill again, the window of the quota policy. */
const REFILL_SECONDS = Math.ceil(
  (PUBLIC_READ_QUOTA.capacity * 60) / PUBLIC_READ_QUOTA.ratePerMinute
);

/**
 * The IETF RateLimit policy field of every answer
 * (draft-ietf-httpapi-ratelimit-headers): the bucket's size and its refill
 * window. No answer carries the `RateLimit` field of the reads left: the
 * bucket is sharded, and counting what is left would read the shards that a
 * client's concurrent reads write, the retries the shards exist to avoid.
 */
export const AGENT_QUOTA_HEADERS = {
  "RateLimit-Policy": `"${PUBLIC_READ_QUOTA.name}";q=${PUBLIC_READ_QUOTA.capacity};w=${REFILL_SECONDS}`,
} as const;

/** Expected public read quota exhaustion. */
export class AgentRateLimitError extends Schema.TaggedError<
  AgentRateLimitError,
  { readonly brand: unique symbol }
>()("AgentRateLimitError", {
  retryAfterMs: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
