import { expect, type Page, test } from "@playwright/test";
import { Effect, Exit } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";

const PROBE_MESSAGE = "page error guard probe";

/** Throws one uncaught error in the page and waits until the page reports it. */
function throwInPage(page: Page) {
  return Effect.promise(() => {
    const reported = page.waitForEvent("pageerror");
    return page
      .evaluate((message) => {
        queueMicrotask(() => {
          throw new Error(message);
        });
      }, PROBE_MESSAGE)
      .then(() => reported);
  });
}

/**
 * The guard reads the page errors after the page work, so an error that the
 * work causes must fail it. A guard that read them before the work would pass
 * both cases.
 */
test("the page error guard passes a quiet page and fails a page that throws", ({
  page,
}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      // A blank document: the guard is under test, not a product page.
      yield* Effect.promise(() =>
        page.setContent("<!doctype html><title>guard</title>")
      );
      const quiet = yield* Effect.exit(
        withObservedPageErrors(page, Effect.void)
      );
      const thrown = yield* Effect.exit(
        withObservedPageErrors(page, throwInPage(page))
      );
      expect(Exit.isSuccess(quiet)).toBe(true);
      expect(Exit.isFailure(thrown)).toBe(true);
    })
  ));
