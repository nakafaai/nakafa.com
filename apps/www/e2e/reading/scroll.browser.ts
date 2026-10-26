import { expect, type Page, test } from "@playwright/test";
import { Deferred, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { APP_SCRIPT_PATTERN } from "@/e2e/support/requests";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How far the reader scrolls into the served page before its scripts run. */
const READ_DEPTH = 1600;

/**
 * Proves that a reader who scrolls a static page before it hydrates keeps their
 * place. The app's scripts wait, as they would on a slow phone, while the
 * reader scrolls into the served page, and the router's first render after
 * hydration leaves the window where the reader put it.
 */
const verifyEarlyScrollKept = Effect.fn("NakafaE2E.verifyEarlyScrollKept")(
  function* (page: Page, href: string) {
    yield* seedAnalyticsConsent(page, "denied");
    const released = yield* Deferred.make<void>();
    const services = yield* Effect.context<never>();
    yield* Effect.promise(() =>
      page.route(APP_SCRIPT_PATTERN, (route) =>
        Effect.runPromiseWith(services)(
          Deferred.await(released).pipe(
            Effect.andThen(() => Effect.promise(() => route.continue()))
          )
        )
      )
    );
    yield* Effect.promise(() =>
      page.goto(href, { waitUntil: "domcontentloaded" })
    );
    yield* Effect.promise(() =>
      page.evaluate(
        (top) => window.scrollTo({ behavior: "instant", top }),
        READ_DEPTH
      )
    );
    const read = yield* Effect.promise(() =>
      page.evaluate(() => window.scrollY)
    );
    yield* Effect.sync(() => expect(read).toBe(READ_DEPTH));
    yield* Deferred.succeed(released, undefined);
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
    yield* Effect.promise(() => page.waitForLoadState("networkidle"));
    const kept = yield* Effect.promise(() =>
      page.evaluate(() => window.scrollY)
    );
    yield* Effect.sync(() => expect(kept).toBe(READ_DEPTH));
  }
);

for (const href of [pinnedRoutes.material.en, pinnedRoutes.article.en]) {
  test(`a reader who scrolls ${href} before it hydrates keeps their place`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await Effect.runPromise(
      withObservedPageErrors(page, verifyEarlyScrollKept(page, href))
    );
  });
}
