import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { describe, expect, it } from "@effect/vitest";
import { generationFailure } from "@repo/backend/confect/nina/failure";
import { RetryError } from "ai";

describe("Nina provider failure contract", () => {
  it("admits only routing facts and a bounded generation identifier", () => {
    for (const generationId of [
      undefined,
      "gen_123-abc",
      "private payload!",
      "x".repeat(129),
    ]) {
      const error = generationFailure(
        new GatewayRateLimitError({
          message: "private provider response",
          cause: { apiKey: "private-secret" },
          ...(generationId === undefined ? {} : { generationId }),
        })
      );
      expect(error.reason).toBe("provider-busy");
      expect(error.diagnostics).toEqual({
        type: "rate_limit_exceeded",
        status: 429,
        retryable: true,
        generation: generationId === "gen_123-abc" ? generationId : undefined,
      });
      expect(JSON.stringify(error)).not.toContain("private");
    }
  });

  it("bounds recursive SDK envelopes instead of following an unbounded cause chain", () => {
    let error: unknown = new GatewayRateLimitError();
    for (let depth = 0; depth < 5; depth += 1) {
      error = new RetryError({
        message: "private",
        reason: "maxRetriesExceeded",
        errors: [error],
      });
    }
    expect(generationFailure(error)).toMatchObject({
      reason: "unknown",
      diagnostics: undefined,
    });
  });
});
