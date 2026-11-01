import { expect, test } from "@playwright/test";

const HOME = "/en";
const WIDTHS = [390, 768, 1440];
/** The room a lazy box keeps past its section, more than any ring or shadow reaches. */
const ROOM = 4;

/**
 * A box that skips its layout clips at its padding edge, so a card that ends on
 * that edge loses its ring and its shadow there, as the home pricing cards did.
 * The sizes come from the page, with every section drawn.
 */
for (const width of WIDTHS) {
  test(`no card on the home page ends on the edge of its lazy box at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto(HOME);
    const tight = await page.evaluate((room) => {
      const boxes = [...document.querySelectorAll("div")].filter(
        (element) => getComputedStyle(element).contentVisibility === "auto"
      );
      for (const box of boxes) {
        box.style.contentVisibility = "visible";
      }
      return boxes.flatMap((box) => {
        const edge = box.getBoundingClientRect();
        return [...box.querySelectorAll('[data-slot="card"]')].flatMap(
          (card) => {
            const { bottom, top } = card.getBoundingClientRect();
            return edge.bottom - bottom < room || top - edge.top < room
              ? [card.textContent?.slice(0, 40)]
              : [];
          }
        );
      });
    }, ROOM);

    expect(tight).toStrictEqual([]);
  });
}
