import { Schema } from "effect";

/**
 * The public read quota of one client: a token bucket that holds 30 reads and
 * refills 120 a minute. The limiter and the RateLimit headers both read it, so a
 * header never names a quota the limiter does not apply.
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

/** The client's quota after one admitted read: the reads left now, and the seconds until the bucket is full. */
export const AgentQuota = Schema.Struct({
  remaining: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  resetSeconds: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * The quota after a read from a bucket that now holds `tokens`, which may be a
 * fraction because the bucket refills continuously.
 */
export function readAgentQuota(tokens: number): typeof AgentQuota.Type {
  const held = Math.min(PUBLIC_READ_QUOTA.capacity, Math.max(0, tokens));
  return {
    remaining: Math.floor(held),
    resetSeconds: Math.ceil(
      ((PUBLIC_READ_QUOTA.capacity - held) * 60) /
        PUBLIC_READ_QUOTA.ratePerMinute
    ),
  };
}

/**
 * The IETF RateLimit fields of an answer (draft-ietf-httpapi-ratelimit-headers):
 * the policy, with the bucket's size and its refill window, and the reads left
 * with the seconds until the bucket is full again.
 */
export function agentQuotaHeaders(quota: typeof AgentQuota.Type) {
  const name = `"${PUBLIC_READ_QUOTA.name}"`;
  return {
    RateLimit: `${name};r=${quota.remaining};t=${quota.resetSeconds}`,
    "RateLimit-Policy": `${name};q=${PUBLIC_READ_QUOTA.capacity};w=${REFILL_SECONDS}`,
  };
}

/** Expected public read quota exhaustion. */
export class AgentRateLimitError extends Schema.TaggedError<
  AgentRateLimitError,
  { readonly brand: unique symbol }
>()("AgentRateLimitError", {
  retryAfterMs: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
