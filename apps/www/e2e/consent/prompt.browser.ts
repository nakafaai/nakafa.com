import {
  type BrowserContextOptions,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
  encodeAnalyticsConsentAccountMarker,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect, MutableList } from "effect";
import { pressDecline, seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { signInLearner } from "@/e2e/support/learner";
import { NEXT_CHUNK_PATH } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { KNOWN_SESSION_KEY } from "@/lib/auth/keys";

/** The first words of the usage-data prompt's description in English. */
const PROMPT_DESCRIPTION = "Allow Nakafa to see which features you use";

/** An earlier notice that a browser may still hold a choice for. */
const OLDER_NOTICE_VERSION = "privacy-2026-08-21";

/** The session the browser last had in the cases that seed one. */
const KNOWN_SESSION = "session-known";

/** A session that ended without a sign-out, whose marker a browser may still hold. */
const EXPIRED_SESSION = "session-expired";

/** A phone, where the prompt covers the lower part of the lesson. */
const compactContext: BrowserContextOptions = {
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
async function stopAppCode(page: Page) {
  await page.route(NEXT_CHUNK_PATH, (route) => route.abort());
}

/** Collects the hydration errors that the page reports while it runs. */
function observeHydrationErrors(page: Page) {
  const errors = MutableList.make<string>();
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_ERROR.test(message.text())) {
      MutableList.append(errors, message.text());
    }
  });
  return errors;
}

/** Stores a raw record under the key the consent store reads, before the page loads. */
function seedRawStorage(page: Page, key: string, value: string) {
  return page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key, value }
  );
}

test("the usage data prompt is in the server HTML, paints before app code, and stays after hydration", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.promise(async () => {
          const page = await context.newPage();
          const hydrationErrors = observeHydrationErrors(page);
          await stopAppCode(page);
          const response = await page.goto(pinnedRoutes.material.en, {
            waitUntil: "domcontentloaded",
          });

          expect(await response?.text()).toContain(PROMPT_DESCRIPTION);
          await expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible();

          await page.unroute(NEXT_CHUNK_PATH);
          await page.reload({ waitUntil: "load" });

          await expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible();
          expect(MutableList.toArray(hydrationErrors)).toEqual([]);
        })
    )
  );
});

test("a visitor who already decided gets no prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          const hydrationErrors = observeHydrationErrors(page);
          yield* seedAnalyticsConsent(page, "granted");
          yield* Effect.promise(() => stopAppCode(page));
          const response = yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          expect(yield* Effect.promise(async () => response?.text())).toContain(
            PROMPT_DESCRIPTION
          );
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );

          yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
          yield* Effect.promise(() => page.reload({ waitUntil: "load" }));

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
          expect(MutableList.toArray(hydrationErrors)).toEqual([]);
        })
    )
  );
});

test("a visitor who denied under an older notice gets no prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          // A denial stays a decision under any notice, as the store reads it.
          const older = yield* encodeAnonymousAnalyticsConsent({
            ...createAnonymousAnalyticsConsent("denied", 1),
            noticeVersion: OLDER_NOTICE_VERSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, older)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

test("a decision made under an older notice keeps the prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          // The store writes this record with the same encoder, under an older notice.
          const older = yield* encodeAnonymousAnalyticsConsent({
            ...createAnonymousAnalyticsConsent("granted", 1),
            noticeVersion: OLDER_NOTICE_VERSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, older)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible()
          );
        })
    )
  );
});

test("a signed-in choice this browser keeps hides the prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          const marker = yield* encodeAnalyticsConsentAccountMarker({
            granted: true,
            noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
            sessionId: KNOWN_SESSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY, marker)
          );
          yield* Effect.promise(() =>
            seedRawStorage(page, KNOWN_SESSION_KEY, KNOWN_SESSION)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

test("a browser privacy signal hides the prompt before and after the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() =>
            page.addInitScript(() => {
              Object.defineProperty(navigator, "globalPrivacyControl", {
                configurable: true,
                get: () => true,
              });
            })
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );

          yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
          yield* Effect.promise(() => page.reload({ waitUntil: "load" }));

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

test("an anonymous denial followed by sign-in to an account with no choice shows the account prompt", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* seedAnalyticsConsent(page, "denied");
          yield* signInLearner(context, baseURL ?? "");
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            })
          );
        })
    )
  );
});

test("an account marker of an expired session does not hide the prompt for a browser with no known session", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          const marker = yield* encodeAnalyticsConsentAccountMarker({
            granted: true,
            noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
            sessionId: EXPIRED_SESSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY, marker)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible()
          );
        })
    )
  );
});

test("a session that ends without a sign-out shows the anonymous prompt once the page knows it", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(browser, { baseURL: baseURL ?? "" }, (context) =>
      Effect.gen(function* () {
        const page = yield* Effect.promise(() => context.newPage());
        yield* signInLearner(context, baseURL ?? "");
        yield* Effect.promise(() =>
          page.goto(pinnedRoutes.material.en, {
            waitUntil: "domcontentloaded",
          })
        );
        // The choice is kept once Convex confirms it, which the marker shows.
        yield* pressDecline(page, false);
        yield* Effect.promise(() =>
          expect
            .poll(() =>
              page.evaluate(
                (key) => localStorage.getItem(key),
                ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY
              )
            )
            .not.toBeNull()
        );

        // A page that loads with the choice kept hides the prompt at once.
        yield* Effect.promise(() =>
          page.goto(pinnedRoutes.material.en, { waitUntil: "load" })
        );
        yield* Effect.promise(() =>
          expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
        );

        // The session ends without a sign-out, so the browser still holds the
        // choice and the session's id. Once the page learns the session is gone,
        // the prompt must show.
        yield* Effect.promise(() => context.clearCookies());
        yield* Effect.promise(() =>
          page.goto(pinnedRoutes.material.en, { waitUntil: "load" })
        );
        yield* Effect.promise(() =>
          expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          })
        );
      })
    )
  );
});
