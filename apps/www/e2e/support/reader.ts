import type { Browser, Page } from "@playwright/test";
import { Effect } from "effect";
import { type Changes, trackChanges } from "./changes";
import { openChatPage } from "./chat";
import { seedAnalyticsConsent } from "./consent";
import { withBrowserContext } from "./context";
import { withObservedPageErrors } from "./observe";

/** The browser of a reader: a window of its own, with no session of the owner's. */
const readerOptions = (baseURL: string) =>
  ({
    baseURL,
    serviceWorkers: "block",
    viewport: { height: 900, width: 1440 },
  }) as const;

/**
 * A page in a browser with no session, the way a reader without an account has
 * it, with the tracker of the changes it sends.
 */
export const withReader = Effect.fn("NakafaE2E.withReader")(function* <A, E, R>(
  browser: Browser,
  baseURL: string,
  use: (page: Page, changes: Changes) => Effect.Effect<A, E, R>
) {
  return yield* withBrowserContext(browser, readerOptions(baseURL), (context) =>
    Effect.gen(function* () {
      const page = yield* Effect.promise(() => context.newPage());
      const changes = yield* trackChanges(page, []);
      yield* seedAnalyticsConsent(page, "denied");
      return yield* withObservedPageErrors(page, use(page, changes));
    })
  );
});

/**
 * A page in a browser signed in as another learner, who owns none of the
 * owner's chats, with the tracker of the changes it sends.
 */
export const withLearner = Effect.fn("NakafaE2E.withLearner")(function* <
  A,
  E,
  R,
>(
  browser: Browser,
  baseURL: string,
  use: (page: Page, changes: Changes) => Effect.Effect<A, E, R>
) {
  return yield* withBrowserContext(browser, readerOptions(baseURL), (context) =>
    Effect.gen(function* () {
      const page = yield* Effect.promise(() => context.newPage());
      const { changes } = yield* openChatPage(page, baseURL);
      return yield* withObservedPageErrors(page, use(page, changes));
    })
  );
});
