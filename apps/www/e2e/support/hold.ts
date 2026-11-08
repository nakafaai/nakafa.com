import type { Page } from "@playwright/test";
import { Duration, Effect } from "effect";
import { SERVER_FUNCTION_PATH, STATIC_DATA_PATH } from "@/e2e/support/requests";

/** How long `holdPageData` keeps each answer: many frames, so any frame between two pages shows. */
const HOLD = Duration.millis(600);

/**
 * Holds every request for a page's data before it leaves the browser: each
 * server function call and each static answer that a prerendered loader reads.
 * A press then waits on the next page's loader for many frames, so the frame
 * recorder sees whatever the page draws while the address has changed and the
 * next page has not rendered yet.
 */
export const holdPageData = Effect.fn("NakafaE2E.holdPageData")(function* (
  page: Page
) {
  const services = yield* Effect.context<never>();
  yield* Effect.promise(() =>
    page.route(
      (url) =>
        url.pathname.startsWith(SERVER_FUNCTION_PATH) ||
        url.pathname.startsWith(STATIC_DATA_PATH),
      (route) =>
        Effect.runPromiseWith(services)(
          Effect.sleep(HOLD).pipe(
            Effect.andThen(Effect.promise(() => route.continue()))
          )
        )
    )
  );
});
