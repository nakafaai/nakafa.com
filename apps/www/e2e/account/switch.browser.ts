import {
  type BrowserContextOptions,
  expect,
  type Page,
  test,
} from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const HOME = "/en";
const ONBOARDING = "/en/onboarding";
const SETTINGS = "/en/user/settings";
const SIGN_IN = "/en/auth";
const HINT_COOKIE = "nakafa-signed-in";
const VISITOR_FOOTER = '[data-slot="sidebar-footer"][data-account="visitor"]';
const MEMBER_FOOTER = '[data-slot="sidebar-footer"][data-account="member"]';
/**
 * A window property that marks one document. A full document load replaces the
 * window, so the marker is gone afterwards, while a client navigation keeps it.
 */
const SAME_DOCUMENT = "nakafaSameDocument";
/** The window property that says whether the lesson ever drew the visitor footer. */
const VISITOR_SEEN = "nakafaVisitorSeen";

/** The context options of every test: the runtime's origin, without service workers. */
function contextOptions(origin: string): BrowserContextOptions {
  return { baseURL: origin, serviceWorkers: "block" };
}

/** Reads the hint attribute of the root element. */
const readRootHint = (page: Page) =>
  page.locator("html").getAttribute("data-signed-in");

/**
 * Watches every frame of a document for the visitor footer on the lesson, so a
 * flash of the sign-in button fails the test even when the footer settles.
 */
function watchVisitorFooter({
  footer,
  lesson,
  property,
}: {
  footer: string;
  lesson: string;
  property: string;
}) {
  const look = () => {
    if (
      location.pathname === lesson &&
      document.querySelector(footer)?.checkVisibility()
    ) {
      Reflect.set(window, property, true);
    }
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

/**
 * The owner signed out, signed in with another account and still saw the sign-in
 * button until a refresh. Google's return lands on the static onboarding page,
 * whose inline script reads the hint once. Here the second account's cookie
 * arrives without the hint, the worst case of that return, because only the real
 * callback's answer sets it (`withSessionHint`). The page must take over from the
 * session read alone, in the same document, and the lesson must never draw the
 * visitor's footer.
 */
test("signing in as another account shows its profile with no reload", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  await Effect.runPromise(
    withBrowserContext(browser, contextOptions(origin), (context) =>
      Effect.gen(function* () {
        yield* signInLearner(context, origin);
        const page = yield* Effect.promise(() => context.newPage());
        yield* withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              page.goto(LESSON_PATH, { waitUntil: "load" })
            );
            const member = page.locator(MEMBER_FOOTER);
            yield* Effect.promise(() =>
              expect(member.getByRole("button").first()).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              })
            );
            yield* Effect.promise(() =>
              member.getByRole("button").first().click()
            );
            yield* Effect.promise(() =>
              page
                .getByRole("menuitem", { name: app.Auth.logout, exact: true })
                .click()
            );
            yield* Effect.promise(() =>
              page.waitForURL((url) => url.pathname === HOME, {
                waitUntil: "load",
              })
            );
            // The answer that signed out cleared the hint, so the home that
            // loaded is a visitor's from its first paint.
            yield* Effect.promise(() =>
              expect
                .poll(() => context.cookies())
                .not.toContainEqual(
                  expect.objectContaining({ name: HINT_COOKIE })
                )
            );
            yield* Effect.promise(async () =>
              expect(await readRootHint(page)).toBe("no")
            );

            yield* signInLearner(context, origin);
            yield* Effect.promise(() =>
              context.clearCookies({ name: HINT_COOKIE })
            );
            yield* Effect.promise(() =>
              page.addInitScript(watchVisitorFooter, {
                footer: VISITOR_FOOTER,
                lesson: LESSON_PATH,
                property: VISITOR_SEEN,
              })
            );
            yield* Effect.promise(() =>
              page.goto(ONBOARDING, { waitUntil: "load" })
            );
            yield* Effect.promise(() =>
              page.evaluate((name) => {
                Object.assign(window, { [name]: true });
              }, SAME_DOCUMENT)
            );
            yield* Effect.promise(() =>
              expect
                .poll(() => readRootHint(page), {
                  timeout: readinessTimeoutMilliseconds,
                })
                .toBe("yes")
            );
            yield* Effect.promise(() =>
              page.evaluate(
                (href) => window.__TSR_ROUTER__?.navigate({ href }),
                LESSON_PATH
              )
            );
            yield* Effect.promise(() =>
              expect(member.getByRole("button").first()).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              })
            );
            yield* Effect.promise(() =>
              expect(page.locator(VISITOR_FOOTER)).toBeHidden()
            );
            yield* Effect.promise(async () => {
              expect(
                await page.evaluate(
                  ([same, seen]) => [
                    Reflect.get(window, same),
                    Reflect.get(window, seen),
                  ],
                  [SAME_DOCUMENT, VISITOR_SEEN]
                )
              ).toStrictEqual([true, undefined]);
            });
          })
        );
      })
    )
  );
});

/**
 * A hint that outlived its session, as after a session ended on the server: the
 * page starts as a learner's, and once Better Auth says there is none it shows the
 * sign-in button in the same document, not an empty footer.
 */
test("a hint that outlived its session shows the sign-in button with no reload", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  await Effect.runPromise(
    withBrowserContext(browser, contextOptions(origin), (context) =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          context.addCookies([{ name: HINT_COOKIE, url: origin, value: "1" }])
        );
        const page = yield* Effect.promise(() => context.newPage());
        yield* withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              page.goto(LESSON_PATH, { waitUntil: "load" })
            );
            yield* Effect.promise(() =>
              expect(page.locator(VISITOR_FOOTER)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              })
            );
            yield* Effect.promise(async () =>
              expect(await readRootHint(page)).toBe("no")
            );
          })
        );
      })
    )
  );
});

/**
 * The gate of the account screens reads on a move between pages, so a session
 * that ends under an open screen has to send the reader away from there. Here
 * another tab signs out, and a session that ends on the server takes the same
 * path: the account screen goes to sign-in with no press and no reload.
 */
test("signing out in one tab sends an account screen in another to sign-in", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  await Effect.runPromise(
    withBrowserContext(browser, contextOptions(origin), (context) =>
      Effect.gen(function* () {
        yield* signInLearner(context, origin);
        const account = yield* Effect.promise(() => context.newPage());
        const page = yield* Effect.promise(() => context.newPage());
        yield* withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              account.goto(SETTINGS, { waitUntil: "load" })
            );
            yield* Effect.promise(() =>
              expect(
                account.locator(MEMBER_FOOTER).getByRole("button").first()
              ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
            );
            yield* Effect.promise(() =>
              page.goto(LESSON_PATH, { waitUntil: "load" })
            );
            const member = page.locator(MEMBER_FOOTER);
            yield* Effect.promise(() =>
              expect(member.getByRole("button").first()).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              })
            );
            yield* Effect.promise(() =>
              member.getByRole("button").first().click()
            );
            yield* Effect.promise(() =>
              page
                .getByRole("menuitem", { name: app.Auth.logout, exact: true })
                .click()
            );
            yield* Effect.promise(() =>
              expect
                .poll(() => new URL(account.url()).pathname, {
                  timeout: readinessTimeoutMilliseconds,
                })
                .toBe(SIGN_IN)
            );
          })
        );
      })
    )
  );
});
