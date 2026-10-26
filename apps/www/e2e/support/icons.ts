import type { Locator } from "@playwright/test";

/**
 * Reads the icons that the items of one surface draw, each item by the first icon in it, and
 * returns every item whose icon another item of the surface draws too, by its accessible text. A
 * sidebar, a menu, a toolbar and a tab row each give every item an icon of its own, so a surface
 * that follows the rule reads back empty.
 */
export function readRepeatedIcons(surface: Locator, items: string) {
  return surface.evaluate((root, selector) => {
    const drawn = Array.from(root.querySelectorAll(selector)).flatMap(
      (item) => {
        const icon = item.querySelector("svg");
        return icon === null
          ? []
          : [
              {
                icon: icon.innerHTML,
                name: (
                  item.getAttribute("aria-label") ??
                  item.textContent ??
                  ""
                ).trim(),
              },
            ];
      }
    );
    return drawn
      .filter(
        (item) => drawn.filter((other) => other.icon === item.icon).length > 1
      )
      .map((item) => item.name);
  }, items);
}
