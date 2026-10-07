import { describe, expect, it } from "@effect/vitest";
import {
  classify,
  GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import { APICallError, NoOutputGeneratedError, RetryError } from "ai";
import { Schema } from "effect";

/** A failure as it crosses into logs and analytics. */
const encode = Schema.encodeSync(Schema.fromJsonString(GatewayFailure));

const url = "https://ai-gateway.convex.dev/v1/chat/completions";

/**
 * A gateway HTTP failure as the provider builds it: its status, its parsed
 * error body, and the `retry-after` header. The message is private.
 */
function httpError(statusCode: number, data?: unknown, retryAfter?: string) {
  return new APICallError({
    message: "private gateway message",
    url,
    requestBodyValues: { prompt: "private prompt" },
    statusCode,
    ...(data === undefined ? {} : { data }),
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
    expect(classify(httpError(status))).toEqual(
      new GatewayFailure({
        reason,
        status,
        retryable: httpError(status).isRetryable,
      })
    );
  });

  it("classifies the unknown model the gateway reports as an invalid request", () => {
    const failure = classify(
      httpError(400, {
        error: { message: "private model is not a valid model ID", code: 400 },
      })
    );
    expect(failure).toEqual(
      new GatewayFailure({ reason: "invalid", status: 400, retryable: false })
    );
    expect(encode(failure)).not.toContain("private");
  });

  it.each([
    [
      "a type the body names",
      {
        error: {
          message: "private",
          type: "invalid_request_error",
          code: "unsupported_parameter",
        },
      },
      "invalid_request_error",
    ],
    [
      "a string code when the body names no type",
      {
        error: {
          message: "private",
          type: null,
          code: "unsupported_parameter",
        },
      },
      "unsupported_parameter",
    ],
    [
      "a numeric code and no type",
      { error: { message: "private", code: 400 } },
      undefined,
    ],
    [
      "a type too long to be an identifier",
      { error: { message: "private", type: "x".repeat(129) } },
      undefined,
    ],
    ["a body without an error object", { message: "private" }, undefined],
  ] as const)("keeps the gateway type for %s", (_, data, type) => {
    expect(classify(httpError(400, data)).type).toBe(type);
  });

  it("classifies a request that never reached the gateway as a network failure", () => {
    const failure = classify(
      new APICallError({
        message: "Cannot connect to API: connect ECONNREFUSED private",
        cause: new Error("connect ECONNREFUSED private"),
        url,
        requestBodyValues: {},
        isRetryable: true,
      })
    );
    expect(failure).toEqual(
      new GatewayFailure({ reason: "network", retryable: true })
    );
    expect(encode(failure)).not.toContain("private");
  });

  it.each([
    [
      "a refused connection",
      new APICallError({
        message: "Cannot connect to API: refused",
        url,
        requestBodyValues: {},
        isRetryable: true,
      }),
      new GatewayFailure({ reason: "network", retryable: true }),
    ],
    [
      "a deadline",
      new DOMException("private", "TimeoutError"),
      new GatewayFailure({ reason: "timeout" }),
    ],
    [
      "an abort",
      new DOMException("private", "AbortError"),
      new GatewayFailure({ reason: "interrupted" }),
    ],
    [
      "an unexplained error",
      new Error("private"),
      new GatewayFailure({ reason: "unknown" }),
    ],
  ] as const)("classifies %s", (_, error, expected) => {
    expect(classify(error)).toEqual(expected);
  });

  it.each([
    ["2", 2],
    ["1.5", 1.5],
    ["Wed, 21 Oct 2026 07:28:00 GMT", undefined],
    ["-1", undefined],
  ] as const)("keeps a retry-after of %s as %s seconds", (header, seconds) => {
    expect(classify(httpError(429, undefined, header)).retryAfter).toBe(
      seconds
    );
  });

  it.each([
    ["an empty output", new NoOutputGeneratedError(), "unknown"],
    ["a thrown string", "private", "unknown"],
    ["nothing", undefined, "unknown"],
  ] as const)("classifies %s by name", (_, error, reason) => {
    expect(classify(error)).toEqual(new GatewayFailure({ reason }));
  });

  it("unwraps retries and empty outputs to the failure behind them", () => {
    const limited = httpError(429, {
      error: { message: "private", code: 429 },
    });
    for (const envelope of [
      new RetryError({
        message: "private",
        reason: "maxRetriesExceeded",
        errors: [httpError(503), limited],
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
        status: 429,
      });
    }
  });

  it("follows a bounded number of envelopes instead of an unbounded chain", () => {
    let error: unknown = httpError(429);
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

  it("admits routing facts only, never a message, body, or payload", () => {
    const failure = classify(
      httpError(400, {
        error: {
          message: "private payload",
          type: "invalid_request_error",
          code: "unsupported_parameter",
        },
      })
    );
    expect(failure).toEqual(
      new GatewayFailure({
        reason: "invalid",
        status: 400,
        retryable: false,
        type: "invalid_request_error",
      })
    );
    expect(encode(failure)).not.toContain("private");
  });
});
