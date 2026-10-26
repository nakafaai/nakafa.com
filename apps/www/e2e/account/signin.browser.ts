import {
  type Browser,
  type BrowserContextOptions,
  expect,
  test,
} from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect, Option } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

const SIGN_IN = "/en/auth";
const HOME = "/en/home";
const PRICING = "/en/pricing";
/** The status of the server's redirect away from the sign-in page. */
const TEMPORARY_REDIRECT = 307;
/**
 * A window property that marks the learner's document. A full document load
 * replaces the window, so the marker is gone afterwards, while a client navigation
 * keeps it.
 */
const LEARNER_DOCUMENT = "nakafaLearnerDocument";

/** The context options of every test: the runtime's origin, without service workers. */
function contextOptions(origin: string): BrowserContextOptions {
  return { baseURL: origin, serviceWorkers: "block" };
}

/**
 * Opens one address as a signed-in learner and proves where the server sent the
 * document: one 307 from the sign-in page, to the given path, so the browser never
 * receives the sign-in page.
 */
const expectRedirected = Effect.fn("NakafaE2E.expectSignInRedirect")(function* (
  origin: string,
  browser: Browser,
  from: string,
  to: string
) {
  yield* withBrowserContext(browser, contextOptions(origin), (context) =>
    Effect.gen(function* () {
      yield* signInLearner(context, origin);
      const page = yield* Effect.promise(() => context.newPage());
      yield* withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const response = yield* Effect.promise(() =>
            page.goto(from, { waitUntil: "load" })
          );
          const redirected = yield* Effect.promise(async () => {
            const first = response?.request().redirectedFrom();
            return Option.fromNullishOr(await first?.response());
          });
          yield* Effect.sync(() => {
            expect(new URL(page.url()).pathname).toBe(to);
            expect(
              Option.map(redirected, (answer) => answer.status())
            ).toStrictEqual(Option.some(TEMPORARY_REDIRECT));
          });
          yield* Effect.promise(() =>
            expect(
              page.getByRole("heading", { name: app.Auth["sign-in-title"] })
            ).toHaveCount(0)
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
    expectRedirected(baseURL ?? "", browser, SIGN_IN, HOME)
  );
});

test("a signed-in learner who opens the sign-in page with an intent lands on it", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const intent = `${SIGN_IN}?${new URLSearchParams({ redirect: LESSON_PATH })}`;
  await Effect.runPromise(
    expectRedirected(baseURL ?? "", browser, intent, LESSON_PATH)
  );
});

/**
 * The Free plan's action of a signed-in learner opens home in the same document,
 * as the header's call to action does, and never names the sign-in page.
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
            const action = page
              .locator('[data-pricing-plan="free"]')
              .getByRole("link", { name: app.Pricing["free-cta"] });
            yield* Effect.promise(() => expect(action).toHaveCount(1));
            yield* Effect.promise(() =>
              expect(action).toHaveAttribute("href", HOME)
            );
            yield* Effect.promise(() =>
              page.evaluate((name) => {
                Object.assign(window, { [name]: true });
              }, LEARNER_DOCUMENT)
            );
            yield* Effect.promise(() => action.click());
            yield* Effect.promise(() =>
              page.waitForURL((url) => url.pathname === HOME)
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
