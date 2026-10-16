import { expect, type Page } from "@playwright/test";
import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentDecision,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { Effect, pipe, Schema, String as Str } from "effect";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  saved,
} from "@/e2e/support/changes";
import { activate, activateUntilVisible } from "@/e2e/support/input";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * The Convex names of the functions that read the signed-in learner and the
 * learner's analytics choice, and of the change that stores it. The refs
 * module cannot be imported here, because it pulls in packages that Node does
 * not resolve outside the bundler.
 */
const CURRENT_USER = "auth/queries:getCurrentUser";
const CURRENT_CHOICE = "consents/current:get";
const SAVE_CHOICE = "consents/current:set";

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

/** The prompt for usage data did not show for a signed-in learner. */
class UsageDataPromptMissing extends Schema.TaggedError<UsageDataPromptMissing>()(
  "UsageDataPromptMissing",
  { shown: Schema.String }
) {
  get message() {
    return `The usage data prompt did not show. ${this.shown}`;
  }
}

/**
 * What a page shows when its prompt is missing: where it is, whether the
 * learner signed in and the backend answered the two reads that decide the
 * prompt, and the first words of the page.
 */
const describePage = Effect.fn("NakafaE2E.describeUsageDataPage")(function* (
  page: Page,
  changes: Changes
) {
  const text = yield* Effect.promise(() =>
    page.evaluate(() => document.body.innerText)
  );

  return `Page ${page.url()}, signed in ${changes.signedIn}, learner read ${changes.hasAnswered(CURRENT_USER)}, choice read ${changes.hasAnswered(CURRENT_CHOICE)}, text "${pipe(text, Str.replaceAll(/\s+/gu, " "), Str.trim, Str.slice(0, 300))}".`;
});

/** What the usage-data prompt calls its Decline button, in each language of the site. */
const DECLINE_LABELS = {
  de: de.AnalyticsConsent.decline,
  en: en.AnalyticsConsent.decline,
  id: id.AnalyticsConsent.decline,
};

/** A language of the site whose usage-data prompt a test can decline. */
export type DeclineLocale = keyof typeof DECLINE_LABELS;

/** The Decline button of the usage-data prompt, in the language of the page. */
const declineButton = (page: Page, locale: DeclineLocale) =>
  page.getByRole("button", { exact: true, name: DECLINE_LABELS[locale] });

/**
 * Presses Decline on the usage-data prompt of a signed-in learner and waits
 * until the prompt is gone. A signed-in learner decides once for the account,
 * so the denial a suite seeds in the browser is not the choice the prompt
 * reads, and the first page of each learner shows it. The prompt hides at once,
 * before the server has the choice: a test that loads another page next waits
 * for the server with `declineUsageData`. The page is the English one unless
 * `locale` names another language of the site.
 */
export const pressDecline = Effect.fn("NakafaE2E.pressDecline")(function* (
  page: Page,
  hasTouch: boolean,
  locale: DeclineLocale = "en"
) {
  const decline = declineButton(page, locale);

  yield* activate(decline, hasTouch);
  yield* Effect.promise(() =>
    expect(decline).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );
});

/**
 * Declines the usage data of a signed-in learner and waits until the server has
 * stored the choice, for a test that loads another page next. The prompt hides
 * before the server has the choice. The Convex client asks the browser to
 * confirm a leave while a change is unanswered, and Playwright accepts that
 * confirmation when a test registers no dialog handler, so the next page can
 * load first. That page finds no choice for the account and asks again, and
 * the prompt would cover what the test presses at a phone's width.
 *
 * The prompt must show within the readiness bound of the suite, or the helper
 * fails with what the page showed. The page is the English one unless `locale`
 * names another language of the site.
 */
export const declineUsageData = Effect.fn("NakafaE2E.declineUsageData")(
  function* (page: Page, changes: Changes, locale: DeclineLocale = "en") {
    yield* Effect.tryPromise(() =>
      expect(declineButton(page, locale)).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      })
    ).pipe(
      Effect.catchTag("UnknownError", () =>
        describePage(page, changes).pipe(
          Effect.flatMap((shown) => new UsageDataPromptMissing({ shown }))
        )
      )
    );
    const before = changes.sent;
    yield* pressDecline(page, false, locale);
    yield* Effect.promise(async () => {
      await expect
        .poll(() => changes.took(SAVE_CHOICE), {
          timeout: ANSWER_MILLISECONDS,
        })
        .toBe(true);
      await saved(changes, before);
    });
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
