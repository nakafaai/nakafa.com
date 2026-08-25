import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "@playwright/test";
import { expect } from "@playwright/test";
import { Effect } from "effect";

/** Owns one isolated Playwright context for the complete use program. */
export const withBrowserContext = Effect.fn("NakafaE2E.withBrowserContext")(
  function* <A, E, R>(
    browser: Browser,
    options: BrowserContextOptions,
    use: (context: BrowserContext) => Effect.Effect<A, E, R>
  ) {
    return yield* Effect.acquireUseRelease(
      Effect.promise(() => browser.newContext(options)),
      use,
      (context) => Effect.promise(() => context[Symbol.asyncDispose]())
    );
  }
);

/** Observes uncaught browser errors for the complete page use program. */
export const withObservedPageErrors = Effect.fn(
  "NakafaE2E.withObservedPageErrors"
)(function* <A, E, R>(
  page: Page,
  use: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => {
      const errors: Error[] = [];
      const recordError = (error: Error) => errors.push(error);
      page.on("pageerror", recordError);
      return { errors, recordError };
    }),
    ({ errors }) =>
      use.pipe(
        Effect.tap(() =>
          Effect.sync(() => expect(errors.map(String)).toEqual([]))
        )
      ),
    ({ recordError }) => Effect.sync(() => page.off("pageerror", recordError))
  );
});
