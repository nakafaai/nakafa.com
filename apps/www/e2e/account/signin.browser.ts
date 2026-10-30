import {
  type Browser,
  type BrowserContextOptions,
  expect,
  type Request,
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
import { waitUntilTakenOver } from "@/e2e/support/window";

const SIGN_IN = "/en/auth";
const HOME = "/en/home";
/**
 * Where home sends the synthetic learner, who has not answered the onboarding
 * questionnaire. Home owns that gate, so the sign-in page sends the learner home.
 */
const ONBOARDING = "/en/onboarding";
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

/** The first request of a redirect chain: the address the page asked for. */
function firstRequestOf(request: Request): Request {
  return Option.match(Option.fromNullishOr(request.redirectedFrom()), {
    onNone: () => request,
    onSome: firstRequestOf,
  });
}

/**
 * Opens one address as a signed-in learner and proves the server's answer: the
 * sign-in page answers 307 to the given path, so the browser never receives the
 * sign-in page, and the document settles on the landing path.
 */
const expectRedirected = Effect.fn("NakafaE2E.expectSignInRedirect")(function* (
  origin: string,
  browser: Browser,
  route: {
    readonly from: string;
    readonly landing: string;
    readonly to: string;
  }
) {
  yield* withBrowserContext(browser, contextOptions(origin), (context) =>
    Effect.gen(function* () {
      yield* signInLearner(context, origin);
      const page = yield* Effect.promise(() => context.newPage());
      yield* withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const response = yield* Effect.promise(() =>
            page.goto(route.from, { waitUntil: "load" })
          );
          const signIn = yield* Effect.promise(async () => {
            const first = Option.map(Option.fromNullishOr(response), (answer) =>
              firstRequestOf(answer.request())
            );
            return Option.fromNullishOr(
              await Option.getOrUndefined(first)?.response()
            );
          });
          yield* Effect.sync(() => {
            expect(
              Option.map(signIn, (answer) => ({
                location: new URL(answer.headers().location ?? "", origin)
                  .pathname,
                status: answer.status(),
              }))
            ).toStrictEqual(
              Option.some({ location: route.to, status: TEMPORARY_REDIRECT })
            );
            expect(new URL(page.url()).pathname).toBe(route.landing);
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
    expectRedirected(baseURL ?? "", browser, {
      from: SIGN_IN,
      landing: ONBOARDING,
      to: HOME,
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
    expectRedirected(baseURL ?? "", browser, {
      from: intent,
      landing: LESSON_PATH,
      to: LESSON_PATH,
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
            // The page is static, so before React takes the link over a press
            // loads home as a new document; only React moves in the same one.
            yield* Effect.promise(() => waitUntilTakenOver(action));
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
