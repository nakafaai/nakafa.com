import {
  GatewayAuthenticationError,
  GatewayFailedDependencyError,
  GatewayInternalServerError,
  GatewayInvalidRequestError,
  GatewayModelNotFoundError,
  GatewayRateLimitError,
  GatewayResponseError,
} from "@ai-sdk/gateway";
import { describe, expect, it } from "@effect/vitest";
import {
  classify,
  GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import {
  AISDKError,
  APICallError,
  NoOutputGeneratedError,
  RetryError,
} from "ai";
import { Schema } from "effect";

/** A failure as it crosses into logs and analytics. */
const encode = Schema.encodeSync(Schema.fromJsonString(GatewayFailure));

/** A provider HTTP failure carrying details that must never survive. */
function apiError(statusCode?: number, retryAfter?: string) {
  return new APICallError({
    message: "private provider response",
    url: "https://provider.example.invalid",
    requestBodyValues: { prompt: "private prompt" },
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(retryAfter === undefined
      ? {}
      : { responseHeaders: { "retry-after": retryAfter } }),
  });
}

describe("Gateway failure classification", () => {
  it.each([
    [429, "rate-limit"],
    [402, "quota"],
    [401, "auth"],
    [403, "auth"],
    [404, "configuration"],
    [424, "configuration"],
    [400, "invalid"],
    [422, "invalid"],
    [413, "too-large"],
    [408, "timeout"],
    [504, "timeout"],
    [500, "unavailable"],
    [503, "unavailable"],
    [409, "unknown"],
  ] as const)("classifies HTTP %i as %s", (status, reason) => {
    expect(classify(apiError(status))).toEqual(
      new GatewayFailure({
        reason,
        status,
        retryable: apiError(status).isRetryable,
      })
    );
  });

  it("classifies a request that never received a status as a network failure", () => {
    const unreachable = new APICallError({
      message: "Cannot connect to API: private",
      url: "https://provider.example.invalid",
      requestBodyValues: {},
      cause: new TypeError("fetch failed"),
      isRetryable: true,
    });
    expect(classify(unreachable)).toEqual(
      new GatewayFailure({ reason: "network", retryable: true })
    );
  });

  it.each([
    ["2", 2],
    ["1.5", 1.5],
    ["Wed, 21 Oct 2026 07:28:00 GMT", undefined],
    ["-1", undefined],
  ] as const)("keeps a retry-after of %s as %s seconds", (header, seconds) => {
    expect(classify(apiError(429, header)).retryAfter).toBe(seconds);
    expect(
      classify(new GatewayRateLimitError({ cause: apiError(429, header) }))
        .retryAfter
    ).toBe(seconds);
  });

  it.each([
    [new GatewayRateLimitError(), "rate-limit", "rate_limit_exceeded"],
    [new GatewayAuthenticationError(), "auth", "authentication_error"],
    [new GatewayModelNotFoundError(), "configuration", "model_not_found"],
    [new GatewayFailedDependencyError(), "configuration", "failed_dependency"],
    [new GatewayInvalidRequestError(), "invalid", "invalid_request_error"],
    [new GatewayInternalServerError(), "unavailable", "internal_server_error"],
    [new GatewayResponseError(), "unavailable", "response_error"],
  ] as const)("classifies %s with its gateway type", (error, reason, type) => {
    expect(classify(error)).toMatchObject({
      reason,
      status: error.statusCode,
      retryable: error.isRetryable,
      type,
    });
  });

  it.each([
    [new GatewayAuthenticationError({ statusCode: 409 }), "auth"],
    [new GatewayInvalidRequestError({ statusCode: 409 }), "unknown"],
  ] as const)(
    "falls back to the name of %s when its status has no reason",
    (error, reason) => {
      expect(classify(error).reason).toBe(reason);
    }
  );

  it.each([
    [
      "an authentication error the AI SDK replaced",
      new AISDKError({ name: "GatewayError", message: "private" }),
      "auth",
    ],
    [
      "a development authentication error",
      Object.assign(new Error("private"), {
        name: "GatewayAuthenticationError",
      }),
      "auth",
    ],
    ["a deadline", new DOMException("private", "TimeoutError"), "timeout"],
    ["an abort", new DOMException("private", "AbortError"), "interrupted"],
    ["an empty output", new NoOutputGeneratedError(), "unknown"],
    ["another error", new Error("private"), "unknown"],
    ["a thrown string", "private", "unknown"],
    ["nothing", undefined, "unknown"],
  ] as const)("classifies %s by name", (_, error, reason) => {
    expect(classify(error)).toEqual(new GatewayFailure({ reason }));
  });

  it("unwraps retries and empty outputs to the failure behind them", () => {
    const limited = new GatewayRateLimitError({ generationId: "gen_1" });
    for (const envelope of [
      new RetryError({
        message: "private",
        reason: "maxRetriesExceeded",
        errors: [apiError(503), limited],
      }),
      new NoOutputGeneratedError({ cause: limited }),
      new RetryError({
        message: "private",
        reason: "errorNotRetryable",
        errors: [new NoOutputGeneratedError({ cause: limited })],
      }),
    ]) {
      expect(classify(envelope)).toMatchObject({
        reason: "rate-limit",
        generation: "gen_1",
      });
    }
  });

  it("follows a bounded number of envelopes instead of an unbounded chain", () => {
    let error: unknown = new GatewayRateLimitError();
    for (let depth = 0; depth < 5; depth += 1) {
      error = new RetryError({
        message: "private",
        reason: "maxRetriesExceeded",
        errors: [error],
      });
    }
    expect(classify(error)).toEqual(new GatewayFailure({ reason: "unknown" }));
  });

  it("keeps a classified failure as it is", () => {
    const failure = new GatewayFailure({ reason: "quota", status: 402 });
    expect(classify(failure)).toBe(failure);
    expect(
      classify(
        new RetryError({
          message: "private",
          reason: "errorNotRetryable",
          errors: [failure],
        })
      )
    ).toBe(failure);
  });

  it("admits routing facts and a bounded generation identifier only", () => {
    for (const generationId of [
      undefined,
      "gen_123-abc",
      "private payload!",
      "x".repeat(129),
    ]) {
      const failure = classify(
        new GatewayRateLimitError({
          message: "private provider response",
          cause: { apiKey: "private-secret" },
          ...(generationId === undefined ? {} : { generationId }),
        })
      );
      expect(failure).toEqual(
        new GatewayFailure({
          reason: "rate-limit",
          status: 429,
          retryable: true,
          type: "rate_limit_exceeded",
          ...(generationId === "gen_123-abc"
            ? { generation: generationId }
            : {}),
        })
      );
      expect(encode(failure)).not.toContain("private");
    }
    expect(encode(classify(apiError(400)))).not.toContain("private");
  });
});
