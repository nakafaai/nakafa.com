import {
  type BrowserContextOptions,
  expect,
  type Page,
} from "@playwright/test";
import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_ROOT_ATTRIBUTE,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentDecision,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect, MutableList, pipe, Schema, String as Str } from "effect";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  saved,
} from "@/e2e/support/changes";
import { activate, activateUntilVisible } from "@/e2e/support/input";
import { NEXT_CHUNK_PATH } from "@/e2e/support/route";
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

/** A button of the usage-data prompt, by its name. */
const promptButton = (page: Page, name: "Allow" | "Decline") =>
  page.getByRole("button", { exact: true, name });

/** The Decline button of the usage-data prompt. */
const declineButton = (page: Page) => promptButton(page, "Decline");

/** Presses one button of the usage-data prompt and waits until the prompt is gone. */
const pressPromptButton = Effect.fn("NakafaE2E.pressPromptButton")(function* (
  page: Page,
  name: "Allow" | "Decline",
  hasTouch: boolean
) {
  const button = promptButton(page, name);

  yield* activate(button, hasTouch);
  yield* Effect.promise(() =>
    expect(button).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );
});

/**
 * Presses Decline on the usage-data prompt of a signed-in learner and waits
 * until the prompt is gone. A signed-in learner decides once for the account,
 * so the denial a suite seeds in the browser is not the choice the prompt
 * reads, and the first page of each learner shows it. The prompt hides at once,
 * before the server has the choice: a test that loads another page next waits
 * for the server with `declineUsageData`.
 */
export const pressDecline = Effect.fn("NakafaE2E.pressDecline")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* pressPromptButton(page, "Decline", hasTouch);
});

/**
 * Presses Allow on the usage-data prompt of a signed-in learner and waits until
 * the prompt is gone. An Allow stores only the account's choice, so the browser
 * keeps no anonymous record that a later visitor of the browser would read.
 */
export const pressAllow = Effect.fn("NakafaE2E.pressAllow")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* pressPromptButton(page, "Allow", hasTouch);
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
 * fails with what the page showed.
 */
export const declineUsageData = Effect.fn("NakafaE2E.declineUsageData")(
  function* (page: Page, changes: Changes) {
    yield* Effect.tryPromise(() =>
      expect(declineButton(page)).toBeVisible({
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
    yield* pressDecline(page, false);
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

/** The first words of the usage-data prompt's description in English. */
export const PROMPT_DESCRIPTION = "Allow Nakafa to see which features you use";

/** A phone, where the prompt covers the lower part of the lesson. */
export const compactContext: BrowserContextOptions = {
  hasTouch: true,
  serviceWorkers: "block",
  viewport: { height: 844, width: 390 },
};

/** React reports a hydration mismatch as a console error that names it. */
const HYDRATION_ERROR = /hydrat|#41[89]|#42[35]/iu;

/**
 * Stops every app chunk from loading, so the page stays as the server sent it
 * and only the inline bootstrap script and the stylesheet can act.
 */
export async function stopAppCode(page: Page) {
  await page.route(NEXT_CHUNK_PATH, (route) => route.abort());
}

/** Collects the hydration errors that the page reports while it runs. */
export function observeHydrationErrors(page: Page) {
  const errors = MutableList.make<string>();
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_ERROR.test(message.text())) {
      MutableList.append(errors, message.text());
    }
  });
  return errors;
}

/** Stores a raw record under the key the consent store reads, before the page loads. */
export function seedRawStorage(page: Page, key: string, value: string) {
  return page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key, value }
  );
}

/**
 * Asserts that the server sent the prompt. A check that the prompt is hidden
 * proves nothing when the prompt is absent, and the copy alone does not prove
 * it either, because the page also carries the copy in its serialized messages.
 */
export function expectPromptRendered(page: Page) {
  return expect(page.getByText(PROMPT_DESCRIPTION)).toBeAttached();
}

/** The account marker that this browser holds, or null when it holds none. */
export function storedAccountMarker(page: Page) {
  return page.evaluate(
    (key) => localStorage.getItem(key),
    ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY
  );
}

/** Whether the document root carries the mark that the bootstrap writes before paint. */
export function isRootMarked(page: Page) {
  return page.evaluate(
    (name) => document.documentElement.hasAttribute(name),
    ANALYTICS_CONSENT_ROOT_ATTRIBUTE
  );
}
