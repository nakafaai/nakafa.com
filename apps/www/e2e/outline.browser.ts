import { expect, type Page, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { readLayoutShift } from "@/e2e/support/layout";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const readinessTimeoutMilliseconds = 15_000;
// Long enough that the server-rendered page paints before it hydrates.
const heldScriptMilliseconds = 1000;
const appScriptPattern = /\/_next\/static\/chunks\/.+\.js$/;

const verifyOutlineHydration = Effect.fn("NakafaE2E.verifyOutlineHydration")(
  function* (page: Page) {
    yield* seedDeniedAnalyticsConsent(page);
    // Holding the app's scripts back paints the server-rendered outline first,
    // as a slow device does; its rows must not move when the page hydrates.
    const services = yield* Effect.context<never>();
    yield* Effect.promise(() =>
      page.route(appScriptPattern, (route) =>
        Effect.runPromiseWith(services)(
          Effect.sleep(Duration.millis(heldScriptMilliseconds)).pipe(
            Effect.andThen(() => Effect.promise(() => route.continue()))
          )
        )
      )
    );

    // Al-Baqarah virtualizes its long outline; Al-Fatihah renders all of it.
    for (const href of ["/en/quran/2", "/en/quran/1"]) {
      yield* Effect.promise(() =>
        page.goto(href, { waitUntil: "domcontentloaded" })
      );
      yield* waitForCommittedAppRouter(
        page,
        href,
        href,
        readinessTimeoutMilliseconds
      );
      yield* Effect.promise(() => page.waitForLoadState("networkidle"));
      const layoutShift = yield* readLayoutShift(page);
      yield* Effect.sync(() => expect(layoutShift).toBeLessThan(0.01));
    }
  }
);

test.describe("Desktop outline", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("keeps its entries still while the page hydrates", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyOutlineHydration(page))
    );
  });
});
