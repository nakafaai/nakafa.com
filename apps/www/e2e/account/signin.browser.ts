import {
  type Browser,
  type BrowserContextOptions,
  expect,
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

const SIGN_IN = "/en/auth";
const HOME = "/en/home";
/**
 * Where home sends the synthetic learner, who has not answered the onboarding
 * questionnaire. Home owns that gate, so the sign-in page sends the learner home.
 */
const ONBOARDING = "/en/onboarding";
const PRICING = "/en/pricing";
/**
 * A window property that marks the learner's document. A full document load
 * replaces the window, so the marker is gone afterwards, while a client navigation
 * keeps it.
 */
const LEARNER_DOCUMENT = "nakafaLearnerDocument";
/**
 * The window property that the sign-in page's watch writes: the path its document
 * opened at, and whether the sign-in title was visible on any frame.
 */
const SIGN_IN_WATCH = "nakafaSignInWatch";

/** The context options of every test: the runtime's origin, without service workers. */
function contextOptions(origin: string): BrowserContextOptions {
  return { baseURL: origin, serviceWorkers: "block" };
}

/**
 * Opens one address as a signed-in learner and proves what the learner sees: the
 * sign-in address answers its static page, whose body the signed-in hint hides
 * before the first paint, and the page sends the learner on in the same
 * document. The sign-in title is visible on no frame.
 */
const expectSentOn = Effect.fn("NakafaE2E.expectSignInSentOn")(function* (
  origin: string,
  browser: Browser,
  route: {
    readonly from: string;
    readonly landing: string;
  }
) {
  yield* withBrowserContext(browser, contextOptions(origin), (context) =>
    Effect.gen(function* () {
      yield* signInLearner(context, origin);
      yield* Effect.promise(() =>
        context.addInitScript(
          ({ property, title }) => {
            const watch = { opened: location.pathname, visible: false };
            Reflect.set(window, property, watch);
            const look = () => {
              for (const heading of document.querySelectorAll("h1")) {
                if (
                  heading.textContent === title &&
                  heading.checkVisibility()
                ) {
                  watch.visible = true;
                }
              }
              requestAnimationFrame(look);
            };
            requestAnimationFrame(look);
          },
          { property: SIGN_IN_WATCH, title: app.Auth["sign-in-title"] }
        )
      );
      const page = yield* Effect.promise(() => context.newPage());
      yield* withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const response = yield* Effect.promise(() =>
            page.goto(route.from, { waitUntil: "load" })
          );
          yield* Effect.sync(() => {
            expect(response?.status()).toBe(200);
            expect(response?.request().redirectedFrom()).toBeNull();
          });
          yield* Effect.promise(() =>
            page.waitForURL((url) => url.pathname === route.landing)
          );
          const watch = yield* Effect.promise(() =>
            page.evaluate(
              (property) => Reflect.get(window, property),
              SIGN_IN_WATCH
            )
          );
          yield* Effect.sync(() =>
            expect(watch).toStrictEqual({
              opened: new URL(route.from, origin).pathname,
              visible: false,
            })
          );
        })
      );
    })
  );
});

test("a signed-in learner who opens the sign-in page lands on home", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    expectSentOn(baseURL ?? "", browser, {
      from: SIGN_IN,
      landing: ONBOARDING,
    })
  );
});

test("a signed-in learner who opens the sign-in page with an intent lands on it", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const intent = `${SIGN_IN}?${new URLSearchParams({ redirect: LESSON_PATH })}`;
  await Effect.runPromise(
    expectSentOn(baseURL ?? "", browser, {
      from: intent,
      landing: LESSON_PATH,
    })
  );
});

/**
 * The Free plan's action of a signed-in learner opens home in the same document,
 * as the header's call to action does, and never names the sign-in page. Home
 * then sends the synthetic learner on to onboarding, in the same document too.
 */
test("the Free plan's action opens home for a signed-in learner", async ({
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
              page.goto(PRICING, { waitUntil: "load" })
            );
            // The action is a link drawn as a button, so it carries the button role.
            const action = page.locator('[data-pricing-plan="free"] a:visible');
            yield* Effect.promise(() => expect(action).toHaveCount(1));
            yield* Effect.promise(() =>
              expect(action).toHaveAttribute("href", HOME)
            );
            yield* Effect.promise(() =>
              expect(action).toHaveText(app.Pricing["free-cta"])
            );
            yield* Effect.promise(() =>
              page.evaluate((name) => {
                Object.assign(window, { [name]: true });
              }, LEARNER_DOCUMENT)
            );
            yield* Effect.promise(() => action.click());
            yield* Effect.promise(() =>
              page.waitForURL((url) => url.pathname === ONBOARDING)
            );
            const sameDocument = yield* Effect.promise(() =>
              page.evaluate(
                (name) => Reflect.has(window, name),
                LEARNER_DOCUMENT
              )
            );
            yield* Effect.sync(() => {
              expect(sameDocument).toBe(true);
              expect(context.pages()).toHaveLength(1);
            });
          })
        );
      })
    )
  );
});
