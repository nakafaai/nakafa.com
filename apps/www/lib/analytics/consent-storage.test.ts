import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AnalyticsConsentStorageFailed,
  loadAnonymousAnalyticsConsent,
  saveAnonymousAnalyticsConsent,
} from "@/lib/analytics/consent-storage";

const consent = createAnonymousAnalyticsConsent("granted", 100);

describe("anonymous analytics consent storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns no decision before the visitor chooses", async () => {
    const loaded = await Effect.runPromise(loadAnonymousAnalyticsConsent());

    expect(Option.isNone(loaded)).toBe(true);
  });

  it("persists and reloads an explicit decision", async () => {
    await Effect.runPromise(saveAnonymousAnalyticsConsent(consent));

    const loaded = await Effect.runPromise(loadAnonymousAnalyticsConsent());

    expect(Option.getOrUndefined(loaded)).toEqual(consent);
    expect(
      window.localStorage.getItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY)
    ).toContain("granted");
  });

  it("fails closed for malformed persisted state", async () => {
    window.localStorage.setItem(
      ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
      "not-json"
    );

    const loaded = await Effect.runPromise(loadAnonymousAnalyticsConsent());

    expect(Option.isNone(loaded)).toBe(true);
  });

  it("fails with a typed error when storage is unavailable", async () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };

    const readFailure = await Effect.runPromise(
      loadAnonymousAnalyticsConsent(unavailableStorage).pipe(Effect.flip)
    );
    const writeFailure = await Effect.runPromise(
      saveAnonymousAnalyticsConsent(consent, unavailableStorage).pipe(
        Effect.flip
      )
    );

    expect(readFailure).toBeInstanceOf(AnalyticsConsentStorageFailed);
    expect(writeFailure).toBeInstanceOf(AnalyticsConsentStorageFailed);
  });

  it("fails with a typed error when a record cannot be encoded", async () => {
    const invalidConsent = {
      ...consent,
      decidedAt: Number.POSITIVE_INFINITY,
    };

    const failure = await Effect.runPromise(
      saveAnonymousAnalyticsConsent(invalidConsent).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AnalyticsConsentStorageFailed);
  });
});
