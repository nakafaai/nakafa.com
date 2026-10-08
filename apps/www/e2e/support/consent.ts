import { expect, type Page } from "@playwright/test";
import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentDecision,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect } from "effect";
import { activateUntilVisible } from "@/e2e/support/input";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * Stores an anonymous consent decision before the first navigation. Suites
 * that are not about consent seed a denial to keep the privacy prompt out of
 * their way, and the analytics suite seeds a grant.
 */
export const seedAnalyticsConsent = Effect.fn("NakafaE2E.seedAnalyticsConsent")(
  function* (page: Page, decision: AnalyticsConsentDecision) {
    const consent = yield* encodeAnonymousAnalyticsConsent(
      createAnonymousAnalyticsConsent(decision, 1)
    );

    yield* Effect.promise(() =>
      page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
        key: ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
        value: consent,
      })
    );
  }
);

/** The footer control that opens the usage-data preferences. */
export function usageDataTrigger(page: Page) {
  return page.locator("footer").getByRole("button", { name: "Usage data" });
}

/**
 * Opens the usage-data preferences in the surface named by `slot`, activating
 * the trigger again until that surface shows, then checks its heading and
 * its Decline and Allow controls.
 */
export const openConsentPreferences = Effect.fn(
  "NakafaE2E.openConsentPreferences"
)(function* (page: Page, slot: "dialog-content" | "drawer-popup") {
  const trigger = usageDataTrigger(page);
  yield* Effect.promise(() => expect(trigger).toBeVisible());
  yield* Effect.promise(() => trigger.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => trigger.focus());
  const popup = page.locator(`[data-slot="${slot}"]`);
  yield* activateUntilVisible(trigger, popup, readinessTimeoutMilliseconds);
  yield* Effect.promise(() =>
    expect(page.getByRole("heading", { name: "Usage data" })).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.getByRole("button", { name: "Decline" })).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.getByRole("button", { name: "Allow" })).toBeVisible()
  );

  return { popup, trigger };
});
