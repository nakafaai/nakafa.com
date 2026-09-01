// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NetworkRequestError,
} from "@repo/backend/client/network";

describe("network request classification", () => {
  it("classifies nested Undici and Node retry codes", () => {
    const cause = new TypeError("fetch failed", {
      cause: Object.assign(new Error("private socket detail"), {
        code: "ECONNRESET",
      }),
    });

    const error = createNetworkRequestError(cause);

    expect(error).toEqual(
      new NetworkRequestError({
        networkCodes: ["ECONNRESET"],
      })
    );
    expect(isRetryableNetworkError(error)).toBe(true);
    expect(JSON.stringify(error)).not.toContain("private socket detail");
  });

  it("deduplicates retry codes across aggregate failures", () => {
    const error = createNetworkRequestError(
      new AggregateError(
        [
          { code: "UND_ERR_SOCKET" },
          { code: "EPIPE" },
          { code: "UND_ERR_SOCKET" },
        ],
        "aggregate network failure"
      )
    );

    expect(error).toMatchObject({
      networkCodes: ["EPIPE", "UND_ERR_SOCKET"],
    });
  });

  it("rejects partially classified failures", () => {
    const failures = [
      new AggregateError(
        [{ code: "ECONNREFUSED" }, { code: "UND_ERR_CONNECT_TIMEOUT" }],
        "mixed network failure"
      ),
      new AggregateError(
        [{ code: "EPIPE" }, new Error("code-less network failure")],
        "partially classified network failure"
      ),
      { cause: "unclassified network failure", code: "EPIPE" },
    ];

    for (const failure of failures) {
      const error = createNetworkRequestError(failure);
      expect(error).toMatchObject({ networkCodes: [] });
      expect(isRetryableNetworkError(error)).toBe(false);
    }
  });

  it.each([
    new Error("unclassified fetch failure"),
    "fetch failed",
    { code: "lowercase-code" },
    { code: 23 },
  ])("keeps code-less and malformed failures terminal", (cause) => {
    expect(createNetworkRequestError(cause)).toMatchObject({
      networkCodes: [],
    });
  });

  it("handles cyclic causes without exposing them", () => {
    const cause: { cause?: unknown; code: string; privateValue: string } = {
      code: "EPIPE",
      privateValue: "private-cycle-value",
    };
    cause.cause = cause;

    const error = createNetworkRequestError(cause);

    expect(error).toMatchObject({
      networkCodes: ["EPIPE"],
    });
    expect(JSON.stringify(error)).not.toContain(cause.privateValue);
  });

  it("keeps accessor failures and oversized graphs terminal", () => {
    const accessorFailure = Object.defineProperty({}, "code", {
      get: () => {
        throw new Error("private accessor detail");
      },
    });
    const oversizedFailure = new AggregateError(
      Array.from({ length: 33 }, () => ({ code: "ECONNRESET" })),
      "oversized network graph"
    );

    for (const cause of [accessorFailure, oversizedFailure]) {
      const error = createNetworkRequestError(cause);
      expect(error).toMatchObject({ networkCodes: [] });
      expect(JSON.stringify(error)).not.toContain("private");
    }
  });
});
