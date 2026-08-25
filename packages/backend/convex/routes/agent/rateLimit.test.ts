// @vitest-environment node
import { NAKAFA_EDGE_CLIENT_IP_HEADER } from "@repo/backend/agent/edge";
import {
  AGENT_RATE_LIMIT_CONFIG,
  AGENT_RATE_LIMIT_MAX_REQUESTS,
  AGENT_RATE_LIMIT_PERIOD_MILLISECONDS,
  AgentRateLimitUnavailableError,
  deriveAgentRateLimitKey,
} from "@repo/backend/convex/routes/agent/rateLimit";
import { afterEach, describe, expect, it, vi } from "@repo/testing/effect";
import { Cause, Effect, Exit } from "effect";

const SHA256_HEXADECIMAL_PATTERN = /^[\da-f]{64}$/u;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agent request rate limit", () => {
  it("owns the documented 120 request per minute policy", () => {
    expect(AGENT_RATE_LIMIT_MAX_REQUESTS).toBe(120);
    expect(AGENT_RATE_LIMIT_PERIOD_MILLISECONDS).toBe(60_000);
    expect(AGENT_RATE_LIMIT_CONFIG).not.toHaveProperty("start");
  });

  it("derives stable pseudonymous keys from normalized edge identities", async () => {
    const first = await Effect.runPromise(
      deriveAgentRateLimitKey(
        new Request("https://api.nakafa.com/v1/search", {
          headers: { [NAKAFA_EDGE_CLIENT_IP_HEADER]: " 203.0.113.10 " },
        })
      )
    );
    const repeated = await Effect.runPromise(
      deriveAgentRateLimitKey(
        new Request("https://api.nakafa.com/v1/content", {
          headers: { [NAKAFA_EDGE_CLIENT_IP_HEADER]: "203.0.113.10" },
        })
      )
    );
    const different = await Effect.runPromise(
      deriveAgentRateLimitKey(
        new Request("https://api.nakafa.com/v1/search", {
          headers: { [NAKAFA_EDGE_CLIENT_IP_HEADER]: "203.0.113.11" },
        })
      )
    );

    expect(first).toBe(repeated);
    expect(first).not.toBe(different);
    expect(first).toMatch(SHA256_HEXADECIMAL_PATTERN);
    expect(first).not.toContain("203.0.113.10");
  });

  it("uses a stable isolated key when the trusted edge header is absent", async () => {
    const first = await Effect.runPromise(
      deriveAgentRateLimitKey(
        new Request("https://example.convex.site/v1/search")
      )
    );
    const repeated = await Effect.runPromise(
      deriveAgentRateLimitKey(new Request("https://example.convex.site/mcp"))
    );

    expect(first).toBe(repeated);
  });

  it("fails closed for an invalid edge client identity", async () => {
    const result = await Effect.runPromiseExit(
      deriveAgentRateLimitKey(
        new Request("https://api.nakafa.com/v1/search", {
          headers: { [NAKAFA_EDGE_CLIENT_IP_HEADER]: "a".repeat(257) },
        })
      )
    );

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const failure = result.cause.reasons.find(Cause.isFailReason);
      expect(failure?.error).toBeInstanceOf(AgentRateLimitUnavailableError);
    }
  });

  it("fails through the typed channel when identity protection is unavailable", async () => {
    vi.spyOn(globalThis.crypto.subtle, "digest").mockRejectedValue(
      new Error("digest unavailable")
    );

    const result = await Effect.runPromiseExit(
      deriveAgentRateLimitKey(
        new Request("https://api.nakafa.com/v1/search", {
          headers: { [NAKAFA_EDGE_CLIENT_IP_HEADER]: "203.0.113.10" },
        })
      )
    );

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const failure = result.cause.reasons.find(Cause.isFailReason);
      expect(failure?.error).toBeInstanceOf(AgentRateLimitUnavailableError);
    }
  });
});
