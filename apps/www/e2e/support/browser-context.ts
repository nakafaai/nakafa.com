import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "@playwright/test";
import { expect } from "@playwright/test";
import { Effect } from "effect";

/**
 * Headed-Chrome user agent mirrored from the Playwright browser without the
 * automation token.
 *
 * PostHog's browser SDK silently drops every capture when it detects an
 * automated visitor (`HeadlessChrome` in the user agent or brands, or
 * `navigator.webdriver`), so analytics suites would observe zero ingest
 * without this disguise. The version is cosmetic; only the absence of the
 * automation markers matters.
 *
 * References:
 * https://posthog.com/docs/libraries/js/config#opt_out_useragent_filter
 */
const REAL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Safari/537.36";

/** Client-hints brands mirroring the headed-Chrome user agent above. */
const REAL_USER_AGENT_BRANDS = [
  { brand: "Chromium", version: "153" },
  { brand: "Google Chrome", version: "153" },
  { brand: "Not-A.Brand", version: "8" },
];

/** Owns one isolated Playwright context for the complete use program. */
export const withBrowserContext = Effect.fn("NakafaE2E.withBrowserContext")(
  function* <A, E, R>(
    browser: Browser,
    options: BrowserContextOptions,
    use: (context: BrowserContext) => Effect.Effect<A, E, R>
  ) {
    return yield* Effect.acquireUseRelease(
      Effect.promise(async () => {
        const context = await browser.newContext({
          userAgent: REAL_USER_AGENT,
          ...options,
        });
        // Hide every automation marker alongside the user agent above so
        // first-party analytics behave exactly as for a real visitor.
        await context.addInitScript(
          ({ brands }: { brands: typeof REAL_USER_AGENT_BRANDS }) => {
            Object.defineProperty(navigator, "webdriver", {
              get: () => false,
            });
            Object.defineProperty(navigator, "userAgentData", {
              get: () => ({
                brands,
                mobile: false,
                platform: "macOS",
              }),
            });
          },
          { brands: REAL_USER_AGENT_BRANDS }
        );
        return context;
      }),
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
