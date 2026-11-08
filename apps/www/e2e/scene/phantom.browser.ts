import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { CARD } from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A lesson whose shell model labels the nucleus with a nuclide, `\vphantom{X}_{Z}\mathrm{Sym}`. */
const ELECTRON_CONFIGURATION_ROUTE =
  "/en/subjects/chemistry/structure-matter/electron-configuration";
/** How KaTeX marks every glyph of a phantom: an inline transparent color, nothing else. */
const PHANTOM = '.katex [style*="color:transparent"]';

/**
 * Reads, for every phantom glyph of the card that sits in an outlined label,
 * the stroke width of the label and of the phantom itself.
 */
function readPhantomStrokes(card: Locator) {
  return card.locator(PHANTOM).evaluateAll((phantoms) =>
    phantoms.flatMap((phantom) => {
      let label = phantom.parentElement;
      while (
        label &&
        Number.parseFloat(
          getComputedStyle(label).getPropertyValue("-webkit-text-stroke-width")
        ) === 0
      ) {
        label = label.parentElement;
      }
      if (!label) {
        return [];
      }
      return [
        {
          label: getComputedStyle(label).getPropertyValue(
            "-webkit-text-stroke-width"
          ),
          phantom: getComputedStyle(phantom).getPropertyValue(
            "-webkit-text-stroke-width"
          ),
        },
      ];
    })
  );
}

const expectPhantomUnstroked = Effect.fn("NakafaE2E.expectPhantomUnstroked")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    const response = yield* Effect.promise(() =>
      page.goto(ELECTRON_CONFIGURATION_ROUTE, {
        waitUntil: "domcontentloaded",
      })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));
    const card = page
      .locator(CARD)
      .filter({ has: page.locator("canvas") })
      .first();
    // Scroll until the lab's deferred scene mounts and draws its nucleus label.
    yield* Effect.promise(() =>
      expect(async () => {
        await page.mouse.wheel(0, 600);
        await card.scrollIntoViewIfNeeded();
        expect(await readPhantomStrokes(card)).not.toEqual([]);
      }).toPass({ timeout: revealTimeoutMilliseconds })
    );
    const strokes = yield* Effect.promise(() => readPhantomStrokes(card));
    for (const stroke of strokes) {
      // The label keeps its outline, and the phantom inside it paints none.
      expect(Number.parseFloat(stroke.label)).toBeGreaterThan(0);
      expect(stroke.phantom).toBe("0px");
    }
  }
);

test.describe("scene label phantoms", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("an outlined nucleus label paints no stroke on the phantom of its nuclide", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, expectPhantomUnstroked(page))
    );
  });
});
