import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readSectionHref, setHref, settledSection } from "@/e2e/support/tryout";

/** Every script the page would load, which the reader's page never runs. */
const SCRIPT = /\.m?js(\?|$)/;
/** A digit, which every number of a section has. */
const DIGIT = /\d/;

/**
 * A try-out section's numbers, its question count and its time, are in the
 * Worker's HTML: NumberFlow draws each one in a declarative shadow root, which
 * the browser builds as it parses the page. A reader whose scripts arrive late
 * sees them at once, instead of empty places until the page hydrates.
 */
test("a try-out section shows its numbers before its scripts run", async ({
  browser,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() => page.goto(setHref));
        const href = yield* readSectionHref(yield* settledSection(page));

        const reader = yield* Effect.promise(() => browser.newPage());
        yield* Effect.promise(() =>
          reader.route(SCRIPT, (route) => route.abort())
        );
        yield* Effect.promise(() =>
          reader.goto(new URL(href, page.url()).href)
        );
        const numbers = yield* Effect.promise(() =>
          reader
            .locator("number-flow-react")
            .evaluateAll((elements) =>
              elements.map((element) => element.shadowRoot?.textContent ?? "")
            )
        );
        yield* Effect.sync(() => {
          expect(numbers).not.toHaveLength(0);
          // Each number that the HTML left empty is listed, so none may be.
          expect(Arr.filter(numbers, (number) => !DIGIT.test(number))).toEqual(
            []
          );
        });
        yield* Effect.promise(() => reader.close());
      })
    )
  );
});
