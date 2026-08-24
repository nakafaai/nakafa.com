// @vitest-environment node

import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import type { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import {
  BrowserSignalRevocationError,
  revokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/signal";

const expectedUserId = "user-1" as Id<"users">;
const revokedDecision = {
  category: ANALYTICS_CONSENT_CATEGORY,
  decidedAt: 100,
  granted: false,
  mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
} satisfies FunctionReturnType<typeof api.consents.current.set>;

describe("browser analytics privacy signal", () => {
  it.effect("succeeds after a bounded transient failure", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi
        .fn(() => Promise.resolve(revokedDecision))
        .mockRejectedValueOnce(new Error("offline"))
        .mockRejectedValueOnce(new Error("still offline"))
        .mockResolvedValue(revokedDecision);
      const fiber = yield* Effect.forkChild(
        revokeAccountAnalyticsGrant(setAccountConsent, expectedUserId)
      );

      yield* TestClock.adjust(Duration.seconds(20));

      const decision = yield* Fiber.join(fiber);
      expect(setAccountConsent).toHaveBeenCalledTimes(3);
      expect(setAccountConsent).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedUserId })
      );
      expect(decision).toEqual(revokedDecision);
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
