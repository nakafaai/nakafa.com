import { expect, test } from "@playwright/test";
import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  encodeAnalyticsConsentAccountMarker,
} from "@repo/analytics/consent";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import {
  compactContext,
  expectPromptRendered,
  isRootMarked,
  PROMPT_DESCRIPTION,
  pressAllow,
  seedAnalyticsConsent,
  seedRawStorage,
  stopAppCode,
  storedAccountMarker,
} from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { KNOWN_SESSION_KEY } from "@/lib/auth/keys";

/** The name of the synthetic learner, which the account button shows. */
const LEARNER_NAME = "Acceptance Learner";

/** The sign-in page, where the sidebar's sign-out goes. */
const AUTH_PAGE = /\/auth(\?|$)/u;

/** The session the browser last had in the cases that seed one. */
const KNOWN_SESSION = "session-known";

/** A session that ended without a sign-out, whose marker a browser may still hold. */
const EXPIRED_SESSION = "session-expired";

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

          yield* Effect.promise(() => expectPromptRendered(page));
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
        // Allow stores only the account's choice, so the browser keeps no
        // anonymous denial that would hide the prompt once the session is gone.
        yield* pressAllow(page, false);
        // The choice is kept once Convex confirms it, which the marker shows.
        yield* Effect.promise(() =>
          expect.poll(() => storedAccountMarker(page)).not.toBeNull()
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

test("a soft sign-out after an account decision shows the anonymous prompt without a reload", async ({
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
        yield* pressAllow(page, false);
        yield* Effect.promise(() =>
          expect.poll(() => storedAccountMarker(page)).not.toBeNull()
        );

        // A page that loads with the choice kept marks the root before paint, and
        // the store removes that mark once it knows the choice.
        yield* Effect.promise(() =>
          page.goto(pinnedRoutes.material.en, { waitUntil: "load" })
        );
        yield* Effect.promise(() =>
          expect.poll(() => isRootMarked(page)).toBe(false)
        );

        // The sidebar's sign-out replaces this page with the sign-in page, and the
        // Back button of that page goes to the home page with no reload.
        yield* Effect.promise(async () => {
          await page
            .locator('[data-sidebar="footer"]')
            .getByRole("button", { name: LEARNER_NAME })
            .click();
          await page
            .getByRole("menuitem", { exact: true, name: app.Auth.logout })
            .click();
          await expect(page).toHaveURL(AUTH_PAGE, {
            timeout: readinessTimeoutMilliseconds,
          });
          await page
            .getByRole("button", { exact: true, name: app.Common.back })
            .click();
        });
        yield* Effect.promise(() =>
          expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          })
        );
      })
    )
  );
});
