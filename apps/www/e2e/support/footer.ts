import type { Locator } from "@playwright/test";

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
