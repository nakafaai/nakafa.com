import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect, Option } from "effect";
import {
  AnalyticsConsentStorageFailed,
  loadAnonymousAnalyticsConsent,
  saveAnalyticsConsentAccountChoice,
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

  it.effect("keeps the signed-in choice marker under the current notice", () =>
    Effect.gen(function* () {
      yield* saveAnalyticsConsentAccountChoice();

      expect(
        window.localStorage.getItem(ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY)
      ).toBe(ANALYTICS_CONSENT_NOTICE_VERSION);
      expect(
        window.localStorage.getItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY)
      ).toBeNull();
    })
  );

  it.effect(
    "reports a typed error when the account choice marker cannot be kept",
    () =>
      Effect.gen(function* () {
        const failure = yield* saveAnalyticsConsentAccountChoice({
          getItem: () => null,
          setItem: () => {
            throw new Error("storage unavailable");
          },
        }).pipe(Effect.flip);

        expect(failure).toBeInstanceOf(AnalyticsConsentStorageFailed);
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
