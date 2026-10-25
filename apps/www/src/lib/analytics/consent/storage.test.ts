import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect, Option } from "effect";
import {
  AnalyticsConsentStorageFailed,
  loadAnonymousAnalyticsConsent,
  saveAnonymousAnalyticsConsent,
} from "@/lib/analytics/consent/storage";

const consent = createAnonymousAnalyticsConsent("granted", 100);

describe("anonymous analytics consent storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it.effect("returns no decision before the visitor chooses", () =>
    Effect.gen(function* () {
      const loaded = yield* loadAnonymousAnalyticsConsent();

      expect(Option.isNone(loaded)).toBe(true);
    })
  );

  it.effect("persists and reloads an explicit decision", () =>
    Effect.gen(function* () {
      yield* saveAnonymousAnalyticsConsent(consent);

      const loaded = yield* loadAnonymousAnalyticsConsent();

      expect(Option.getOrUndefined(loaded)).toEqual(consent);
      expect(
        window.localStorage.getItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY)
      ).toContain("granted");
    })
  );

  it.effect("fails closed for malformed persisted state", () =>
    Effect.gen(function* () {
      window.localStorage.setItem(
        ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
        "not-json"
      );

      const loaded = yield* loadAnonymousAnalyticsConsent();

      expect(Option.isNone(loaded)).toBe(true);
    })
  );

  it.effect("fails with a typed error when storage is unavailable", () =>
    Effect.gen(function* () {
      const unavailableStorage = {
        getItem: () => {
          throw new Error("storage unavailable");
        },
        setItem: () => {
          throw new Error("storage unavailable");
        },
      };

      const readFailure = yield* loadAnonymousAnalyticsConsent(
        unavailableStorage
      ).pipe(Effect.flip);
      const writeFailure = yield* saveAnonymousAnalyticsConsent(
        consent,
        unavailableStorage
      ).pipe(Effect.flip);

      expect(readFailure).toBeInstanceOf(AnalyticsConsentStorageFailed);
      expect(writeFailure).toBeInstanceOf(AnalyticsConsentStorageFailed);
    })
  );

  it.effect("fails with a typed error when a record cannot be encoded", () =>
    Effect.gen(function* () {
      const invalidConsent = {
        ...consent,
        decidedAt: Number.POSITIVE_INFINITY,
      };

      const failure = yield* saveAnonymousAnalyticsConsent(invalidConsent).pipe(
        Effect.flip
      );

      expect(failure).toBeInstanceOf(AnalyticsConsentStorageFailed);
    })
  );
});
