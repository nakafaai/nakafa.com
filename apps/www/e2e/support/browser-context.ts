import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
} from "@playwright/test";
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
