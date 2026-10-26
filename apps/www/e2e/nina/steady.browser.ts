import { expect, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { NINA_SECTION } from "@/e2e/support/selector";

const HOME = "/en";
/** The session route, which the test answers late so the session loads on screen. */
const SESSION_READ = "**/api/auth/get-session**";
/** How long the session read waits before it answers. */
const SESSION_DELAY = Duration.seconds(2);
/** The window mark set once any composer of the page has been disabled. */
const DIMMED = "nakafaComposerDimmed";

/**
 * A signed-in learner's home composer looks the same while the page's session
 * loads: it never turns disabled and back, so the learner sees no flicker, and
 * its text box takes typing the whole time.
 */
test("a signed-in learner's home composer never dims while the session loads", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: origin, serviceWorkers: "block" },
      (context) =>
        Effect.gen(function* () {
          yield* signInLearner(context, origin);
          yield* Effect.promise(() =>
            context.route(SESSION_READ, async (route) => {
              await Effect.runPromise(Effect.sleep(SESSION_DELAY));
              await route.continue();
            })
          );
          yield* Effect.promise(() =>
            context.addInitScript((mark: string) => {
              new MutationObserver(() => {
                if (document.querySelector("form textarea:disabled")) {
                  Reflect.set(window, mark, true);
                }
              }).observe(document, {
                attributeFilter: ["disabled"],
                attributes: true,
                childList: true,
                subtree: true,
              });
            }, DIMMED)
          );
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() => page.goto(HOME));
          const composer = page
            .locator(NINA_SECTION)
            .getByRole("textbox", { name: "Ask Nina anything..." });
          yield* Effect.promise(() => composer.scrollIntoViewIfNeeded());
          yield* Effect.sleep(Duration.times(SESSION_DELAY, 2));
          yield* Effect.promise(async () => {
            await expect(composer).toBeEnabled();
            expect(
              await page.evaluate((mark) => Reflect.get(window, mark), DIMMED)
            ).not.toBe(true);
          });
        })
    )
  );
});
