import type { Page } from "@playwright/test";
import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect } from "effect";

/** Keeps non-consent browser suites isolated from the initial privacy prompt. */
export const seedDeniedAnalyticsConsent = Effect.fn(
  "NakafaE2E.seedDeniedAnalyticsConsent"
)(function* (page: Page) {
  const deniedConsent = yield* encodeAnonymousAnalyticsConsent(
    createAnonymousAnalyticsConsent("denied", 1)
  );

  yield* Effect.promise(() =>
    page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
      value: deniedConsent,
    })
  );
});
