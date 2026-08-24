// @vitest-environment node

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "@repo/testing/effect";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import {
  BrowserSignalRevocationError,
  revokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/signal";

const expectedUserId = "user-1" as Id<"users">;

describe("browser analytics privacy signal", () => {
  it.effect("succeeds after a bounded transient failure", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error("offline"))
        .mockRejectedValueOnce(new Error("still offline"))
        .mockResolvedValue(undefined);
      const fiber = yield* Effect.forkChild(
        revokeAccountAnalyticsGrant(setAccountConsent, expectedUserId)
      );

      yield* TestClock.adjust(Duration.seconds(20));

      yield* Fiber.join(fiber);
      expect(setAccountConsent).toHaveBeenCalledTimes(3);
      expect(setAccountConsent).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedUserId })
      );
    })
  );

  it.effect("surfaces a typed failure after exactly three attempts", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi.fn(() =>
        Promise.reject(new Error("offline"))
      );
      const fiber = yield* Effect.forkChild(
        revokeAccountAnalyticsGrant(setAccountConsent, expectedUserId).pipe(
          Effect.flip
        )
      );

      yield* TestClock.adjust(Duration.seconds(20));

      const failure = yield* Fiber.join(fiber);
      expect(failure).toBeInstanceOf(BrowserSignalRevocationError);
      expect(setAccountConsent).toHaveBeenCalledTimes(3);
    })
  );
});
