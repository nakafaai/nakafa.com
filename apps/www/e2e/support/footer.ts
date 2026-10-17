import type { Locator, Page } from "@playwright/test";
import { Effect } from "effect";

/**
 * Measures each action of a card's footer: its label, whether the label is cut
 * off, whether the action lies inside the card that holds it, and its top edge,
 * so a test can tell whether the actions share a row.
 */
export function readFooterActions(actions: Locator) {
  return actions.evaluateAll((elements) =>
    elements.map((element) => {
      const card = element
        .closest('[data-slot="card"]')
        ?.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return {
        clipped: element.scrollWidth > element.clientWidth,
        inside:
          card !== undefined &&
          box.left >= card.left &&
          box.right <= card.right &&
          box.top >= card.top &&
          box.bottom <= card.bottom,
        label: element.textContent?.trim() ?? "",
        top: box.top,
      };
    })
  );
}

/**
 * Sets the browser text to 200 percent and resolves the root font size once the
 * fonts have loaded. Doubling the root font size doubles every rem with it, so a
 * footer measured after this is the footer a learner with large text sees.
 */
export const setLargeText = Effect.fn("NakafaE2E.setLargeText")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.addStyleTag({ content: "html { font-size: 200% !important; }" })
  );
  yield* Effect.promise(() =>
    page.evaluate(async () => {
      await document.fonts.ready;
    })
  );
  return yield* Effect.promise(() =>
    page.evaluate(() => getComputedStyle(document.documentElement).fontSize)
  );
});
