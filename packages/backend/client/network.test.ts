// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_RETRY_SCHEDULE,
  NetworkRequestError,
} from "@repo/backend/client/network";
import { Duration, Effect, Fiber, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);

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
    expect(Schema.encodeSync(JsonTextSchema)(error)).not.toContain(
      "private socket detail"
    );
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
      new AggregateError([{ code: "EPIPE" }, null], "unclassified leaf"),
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
    expect(Schema.encodeSync(JsonTextSchema)(error)).not.toContain(
      cause.privateValue
    );
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
      expect(Schema.encodeSync(JsonTextSchema)(error)).not.toContain("private");
    }
  });
});

describe("network retry schedule", () => {
  it.effect(
    "retries a failed read twice, after 500 milliseconds and then 1 second",
    () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0);
        const read = Ref.update(attempts, (count) => count + 1).pipe(
          Effect.andThen(Effect.fail("network failure")),
          Effect.retry(NETWORK_RETRY_SCHEDULE),
          Effect.flip
        );
        const fiber = yield* Effect.forkChild(read);

        yield* TestClock.adjust(Duration.millis(499));
        expect(yield* Ref.get(attempts)).toBe(1);
        yield* TestClock.adjust(Duration.millis(1));
        expect(yield* Ref.get(attempts)).toBe(2);
        yield* TestClock.adjust(Duration.millis(999));
        expect(yield* Ref.get(attempts)).toBe(2);
        yield* TestClock.adjust(Duration.millis(1));
        expect(yield* Ref.get(attempts)).toBe(3);

        expect(yield* Fiber.join(fiber)).toBe("network failure");
        yield* TestClock.adjust(Duration.seconds(60));
        expect(yield* Ref.get(attempts)).toBe(3);
      })
  );
});
