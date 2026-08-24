// @vitest-environment node

import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import type { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Duration, Effect, Fiber, Option } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import {
  AccountConsentPersistenceError,
  AccountConsentRejectedError,
  readBrowserPrivacySignal,
  revokeAccountAnalyticsGrant,
  saveAccountAnalyticsChoice,
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
  it.effect("reads current browser values on every execution", () =>
    Effect.gen(function* () {
      let doNotTrack: string | null | undefined;
      let globalPrivacyControl: unknown;
      const source = {
        read() {
          return { doNotTrack, globalPrivacyControl };
        },
      };

      expect(yield* readBrowserPrivacySignal(source)).toBe(false);

      doNotTrack = "1";
      expect(yield* readBrowserPrivacySignal(source)).toBe(true);

      doNotTrack = "0";
      globalPrivacyControl = true;
      expect(yield* readBrowserPrivacySignal(source)).toBe(true);

      globalPrivacyControl = false;
      expect(yield* readBrowserPrivacySignal(source)).toBe(false);
    })
  );

  it.effect("succeeds after a bounded transient failure", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi
        .fn(() => Promise.resolve(revokedDecision))
        .mockRejectedValueOnce(new Error("offline"))
        .mockRejectedValueOnce(new Error("still offline"))
        .mockResolvedValue(revokedDecision);
      const fiber = yield* Effect.forkChild(
        revokeAccountAnalyticsGrant(
          setAccountConsent,
          expectedUserId,
          Effect.succeed(true)
        )
      );

      yield* TestClock.adjust(Duration.seconds(20));

      const decision = yield* Fiber.join(fiber);
      expect(setAccountConsent).toHaveBeenCalledTimes(3);
      expect(setAccountConsent).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedUserId })
      );
      expect(Option.getOrUndefined(decision)).toEqual(revokedDecision);
    })
  );

  it.effect("surfaces a typed failure after exactly three attempts", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi.fn(() =>
        Promise.reject(new Error("offline"))
      );
      const fiber = yield* Effect.forkChild(
        revokeAccountAnalyticsGrant(
          setAccountConsent,
          expectedUserId,
          Effect.succeed(true)
        ).pipe(Effect.flip)
      );

      yield* TestClock.adjust(Duration.seconds(20));

      const failure = yield* Fiber.join(fiber);
      expect(failure).toBeInstanceOf(AccountConsentPersistenceError);
      expect(setAccountConsent).toHaveBeenCalledTimes(3);
    })
  );

  it.effect("does not retry an authoritative account rejection", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi.fn(() =>
        Promise.reject(
          new ConvexError({
            code: "CONSENT_ACCOUNT_CHANGED",
            message:
              "The active account changed before consent could be saved.",
          })
        )
      );

      const failure = yield* saveAccountAnalyticsChoice(
        setAccountConsent,
        expectedUserId,
        true,
        Effect.succeed(false)
      ).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(AccountConsentRejectedError);
      expect(setAccountConsent).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("stops a delayed explicit retry when its owner interrupts it", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi.fn(() =>
        Promise.reject(new Error("offline"))
      );
      const fiber = yield* Effect.forkChild(
        saveAccountAnalyticsChoice(
          setAccountConsent,
          expectedUserId,
          true,
          Effect.succeed(false)
        )
      );

      yield* TestClock.adjust(Duration.zero);
      expect(setAccountConsent).toHaveBeenCalledTimes(1);

      yield* Fiber.interrupt(fiber);
      yield* TestClock.adjust(Duration.seconds(20));

      expect(setAccountConsent).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("skips revocation after a stale signal clears", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi.fn(() => Promise.resolve(revokedDecision));

      const decision = yield* revokeAccountAnalyticsGrant(
        setAccountConsent,
        expectedUserId,
        Effect.succeed(false)
      );

      expect(Option.isNone(decision)).toBe(true);
      expect(setAccountConsent).not.toHaveBeenCalled();
    })
  );

  it.effect("rechecks the signal before retrying a failed revocation", () =>
    Effect.gen(function* () {
      let doNotTrack: string | null | undefined = "1";
      const source = {
        read: () => ({ doNotTrack, globalPrivacyControl: false }),
      };
      const setAccountConsent = vi.fn(() => {
        doNotTrack = "0";
        return Promise.reject(new Error("offline"));
      });
      const fiber = yield* Effect.forkChild(
        revokeAccountAnalyticsGrant(
          setAccountConsent,
          expectedUserId,
          readBrowserPrivacySignal(source)
        )
      );

      yield* TestClock.adjust(Duration.seconds(10));

      expect(Option.isNone(yield* Fiber.join(fiber))).toBe(true);
      expect(setAccountConsent).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("rechecks the browser before every explicit grant", () =>
    Effect.gen(function* () {
      let doNotTrack: string | null | undefined;
      const source = {
        read: () => ({
          doNotTrack,
          globalPrivacyControl: false,
        }),
      };
      const setAccountConsent = vi.fn((args) =>
        Promise.resolve({ ...args.decision, decidedAt: 100 })
      );

      yield* saveAccountAnalyticsChoice(
        setAccountConsent,
        expectedUserId,
        true,
        readBrowserPrivacySignal(source)
      );

      doNotTrack = "1";
      yield* saveAccountAnalyticsChoice(
        setAccountConsent,
        expectedUserId,
        true,
        readBrowserPrivacySignal(source)
      );

      expect(setAccountConsent).toHaveBeenNthCalledWith(1, {
        decision: {
          category: ANALYTICS_CONSENT_CATEGORY,
          granted: true,
          mechanism: ANALYTICS_CONSENT_MECHANISM,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        },
        expectedUserId,
      });
      expect(setAccountConsent).toHaveBeenNthCalledWith(2, {
        decision: {
          category: ANALYTICS_CONSENT_CATEGORY,
          granted: false,
          mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        },
        expectedUserId,
      });
    })
  );

  it.effect("persists an explicit decline without changing its mechanism", () =>
    Effect.gen(function* () {
      const setAccountConsent = vi.fn((args) =>
        Promise.resolve({ ...args.decision, decidedAt: 100 })
      );

      yield* saveAccountAnalyticsChoice(
        setAccountConsent,
        expectedUserId,
        false,
        Effect.succeed(true)
      );

      expect(setAccountConsent).toHaveBeenCalledWith({
        decision: {
          category: ANALYTICS_CONSENT_CATEGORY,
          granted: false,
          mechanism: ANALYTICS_CONSENT_MECHANISM,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        },
        expectedUserId,
      });
    })
  );
});
