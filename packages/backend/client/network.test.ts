// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  classifyNetworkFailure,
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_RETRY_SCHEDULE,
  NetworkRequestError,
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { encodeJsonText } from "@repo/utilities/json";
import { Duration, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";

describe("network request classification", () => {
  it("classifies nested Undici and Node retry codes", () => {
    const cause = new TypeError("fetch failed", {
      cause: Object.assign(new Error("private socket detail"), {
        code: "ECONNRESET",
      }),
    });

    const error = createNetworkRequestError(cause);

    expect(error).toEqual(
      NetworkRequestError.make({
        networkCodes: ["ECONNRESET"],
      })
    );
    expect(isRetryableNetworkError(error)).toBe(true);
    expect(encodeJsonText(error)).not.toContain("private socket detail");
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
    expect(encodeJsonText(error)).not.toContain(cause.privateValue);
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
      expect(encodeJsonText(error)).not.toContain("private");
    }
  });

  it("keeps a terminal cause as the caller's failure and marks a retryable one", () => {
    const failure = "caller failure";
    const retryableCause = new TypeError("fetch failed", {
      cause: Object.assign(new Error("private socket detail"), {
        code: "ECONNRESET",
      }),
    });

    expect(
      classifyNetworkFailure(new Error("unclassified fetch failure"), failure)
    ).toBe(failure);
    const classified = classifyNetworkFailure(retryableCause, failure);
    expect(classified).toBeInstanceOf(RetryableNetworkAttempt);
    expect(classified).toMatchObject({ failure });
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

describe("network attempt retry", () => {
  it.effect("returns the first success without a repeat", () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0);
      const attempt = Ref.update(attempts, (count) => count + 1).pipe(
        Effect.as("answer")
      );

      expect(yield* retryNetworkAttempt(attempt, "deadline failure")).toBe(
        "answer"
      );
      expect(yield* Ref.get(attempts)).toBe(1);
    })
  );

  it.effect(
    "repeats a retryable failure after 500 milliseconds and then 1 second, and fails with the caller's failure unwrapped",
    () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0);
        const attempt = Ref.update(attempts, (count) => count + 1).pipe(
          Effect.andThen(
            Effect.fail(
              new RetryableNetworkAttempt({ failure: "network failure" })
            )
          )
        );
        const fiber = yield* Effect.forkChild(
          retryNetworkAttempt(attempt, "deadline failure").pipe(Effect.flip)
        );

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

  it.effect(
    "repeats a missed deadline, then fails with the deadline failure after 31.5 seconds",
    () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0);
        const attempt = Ref.update(attempts, (count) => count + 1).pipe(
          Effect.andThen(Effect.never)
        );
        const fiber = yield* Effect.forkChild(
          retryNetworkAttempt(attempt, "deadline failure").pipe(Effect.flip)
        );

        // Each attempt ends at its ten second deadline. The waits are 500 milliseconds, then 1 second.
        yield* TestClock.adjust(Duration.millis(10_499));
        expect(yield* Ref.get(attempts)).toBe(1);
        yield* TestClock.adjust(Duration.millis(1));
        expect(yield* Ref.get(attempts)).toBe(2);
        yield* TestClock.adjust(Duration.millis(10_999));
        expect(yield* Ref.get(attempts)).toBe(2);
        yield* TestClock.adjust(Duration.millis(1));
        expect(yield* Ref.get(attempts)).toBe(3);
        yield* TestClock.adjust(Duration.millis(9999));
        expect(yield* Ref.get(attempts)).toBe(3);

        yield* TestClock.adjust(Duration.millis(1));
        expect(yield* Fiber.join(fiber)).toBe("deadline failure");
        expect(yield* Ref.get(attempts)).toBe(3);
      })
  );

  it.effect("returns a failure that is not retryable at once, unwrapped", () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0);
      const attempt = Ref.update(attempts, (count) => count + 1).pipe(
        Effect.andThen(Effect.fail("terminal failure"))
      );

      expect(
        yield* retryNetworkAttempt(attempt, "deadline failure").pipe(
          Effect.flip
        )
      ).toBe("terminal failure");
      expect(yield* Ref.get(attempts)).toBe(1);
    })
  );
});
