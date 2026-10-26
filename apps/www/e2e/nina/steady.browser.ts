import { type Browser, expect, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { CHAT_PATH } from "@/e2e/support/chat";
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
 * Opens one page as a signed-in learner whose session answers late, and proves
 * that its composer never turned disabled and back while the session loaded:
 * the learner sees no flicker, and the text box takes typing the whole time.
 */
const expectSteadyComposer = Effect.fn("NakafaE2E.expectSteadyComposer")(
  function* (
    browser: Browser,
    origin: string,
    page: { readonly path: string; readonly scope: string }
  ) {
    yield* withBrowserContext(
      browser,
      { baseURL: origin, serviceWorkers: "block" },
      (context) =>
        Effect.gen(function* () {
          yield* signInLearner(context, origin);
          const services = yield* Effect.context();
          yield* Effect.promise(() =>
            context.route(SESSION_READ, async (route) => {
              await Effect.runPromiseWith(services)(Effect.sleep(SESSION_DELAY));
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
          const tab = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() => tab.goto(page.path));
          const composer = tab
            .locator(page.scope)
            .getByRole("textbox", { name: "Ask Nina anything..." });
          yield* Effect.promise(() => composer.scrollIntoViewIfNeeded());
          yield* Effect.sleep(Duration.times(SESSION_DELAY, 2));
          yield* Effect.promise(async () => {
            await expect(composer).toBeEnabled();
            expect(
              await tab.evaluate((mark) => Reflect.get(window, mark), DIMMED)
            ).not.toBe(true);
          });
        })
    );
  }
);

test("a signed-in learner's home composer never dims while the session loads", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    expectSteadyComposer(browser, baseURL ?? "", {
      path: HOME,
      scope: NINA_SECTION,
    })
  );
});

test("a signed-in learner's new-chat composer never dims while the session loads", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    expectSteadyComposer(browser, baseURL ?? "", {
      path: CHAT_PATH,
      scope: "main",
    })
  );
});
