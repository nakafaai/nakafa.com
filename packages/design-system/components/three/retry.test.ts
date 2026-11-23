import { describe, expect, it } from "@effect/vitest";
import {
  retryDelayMillis,
  SCENE_RETRY_DELAYS,
  waitRetryDelay,
} from "@repo/design-system/components/three/retry";
import { Duration, Effect, Fiber, Option } from "effect";
import { TestClock } from "effect/testing";

describe("retryDelayMillis", () => {
  it("returns configured backoff delays for valid attempts and none once exhausted", () => {
    expect(retryDelayMillis(0)).toEqual(Option.none());
    expect(retryDelayMillis(1)).toEqual(Option.some(SCENE_RETRY_DELAYS[0]));
    expect(retryDelayMillis(2)).toEqual(Option.some(SCENE_RETRY_DELAYS[1]));
    expect(retryDelayMillis(3)).toEqual(Option.none());
  });
});

describe("waitRetryDelay", () => {
  it.effect("waits for the backoff delay before resolving true", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(waitRetryDelay(1));
      yield* TestClock.adjust(Duration.millis(150));
      const shouldRetry = yield* Fiber.join(fiber);
      expect(shouldRetry).toBe(true);
    })
  );

  it.effect("resolves false immediately once retries are exhausted", () =>
    Effect.gen(function* () {
      const shouldRetry = yield* waitRetryDelay(3);
      expect(shouldRetry).toBe(false);
    })
  );
});
