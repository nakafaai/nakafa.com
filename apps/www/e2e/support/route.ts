import { expect, type Page } from "@playwright/test";
import type { AnalyticsConsentDecision } from "@repo/analytics/consent";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";

/** The English app routes that several suites open by name. */
export const appRoutes = {
  quran: "/en/quran",
  quranSurah: "/en/quran/2",
  tryout: "/en/try-out",
} as const;

/**
 * Seeds one consent decision before the first navigation, then opens `href`
 * and expects the server to answer it with a page.
 */
export const openRoute = Effect.fn("NakafaE2E.openRoute")(function* (
  page: Page,
  href: string,
  consent: AnalyticsConsentDecision
) {
  yield* seedAnalyticsConsent(page, consent);
  const response = yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
});
