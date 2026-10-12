import type { Locator, Page } from "@playwright/test";

/**
 * The text of every element in `scope`, itself included, that holds more width
 * than it shows: text that is cut off. A box meant to scroll sideways is not
 * text that is cut, so an element that scrolls on its own is left out.
 */
export function cutText(scope: Locator) {
  return scope.evaluate((root) =>
    [root, ...root.querySelectorAll("*")]
      .filter(
        (element) =>
          element.scrollWidth > element.clientWidth &&
          !["auto", "scroll"].includes(getComputedStyle(element).overflowX)
      )
      .map((element) => element.textContent?.trim() ?? "")
  );
}

/** The row of evidence that carries `label`: the nearest box around it that holds math. */
export function rowOf(label: Locator) {
  return label.locator(
    "xpath=ancestor::div[.//*[contains(@class, 'katex')]][1]"
  );
}

/**
 * Whether every formula in `row` can be read: it lies within the row, or in a
 * box that scrolls on its own, so a reader reaches the rest of it.
 */
export function reachable(row: Locator) {
  return row.evaluate((root) => {
    const edge = root.getBoundingClientRect().right;
    return [...root.querySelectorAll(".katex")].every(
      (formula) =>
        formula.getBoundingClientRect().right <= edge + 0.5 ||
        formula.closest('[data-slot="scroll-area-viewport"]') !== null
    );
  });
}

/** How far the page scrolls sideways, in pixels: zero for a page that fits its viewport. */
export function overflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
}

/** How many lines of text an element shows, from its height and its line height. */
export function lines(locator: Locator) {
  return locator.evaluate((element) =>
    Math.round(
      element.getBoundingClientRect().height /
        Number.parseFloat(getComputedStyle(element).lineHeight)
    )
  );
}

/**
 * Whether an element holds more text than its box shows: the text that a line
 * clamp cuts below its last line. `lines` reads the height of the box, which
 * is the same for a title that fits in two lines and for one that is cut there.
 */
export function clamped(locator: Locator) {
  return locator.evaluate(
    (element) => element.scrollHeight > element.clientHeight
  );
}

/**
 * How many pixels of its text an element of one line clips above and below its
 * own box. The ink of the text is measured on a canvas in the element's font,
 * from its baseline, and set against the box that clips it. The baseline is
 * where the layout put it: an ascent below the top of the line the page drew.
 */
export function clippedInk(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const context = document.createElement("canvas").getContext("2d");
    const range = document.createRange();
    range.selectNodeContents(element);
    const line = range.getClientRects().item(0);
    if (!(context && line)) {
      return { above: 0, below: 0 };
    }
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = context.measureText(element.textContent ?? "");
    const box = element.getBoundingClientRect();
    const baseline = line.top - box.top + text.fontBoundingBoxAscent;
    return {
      above: Math.max(0, text.actualBoundingBoxAscent - baseline),
      below: Math.max(
        0,
        text.actualBoundingBoxDescent - (box.height - baseline)
      ),
    };
  });
}

/**
 * How far the replies of a chat reach past the right edge of the page, in
 * pixels. What a box that scrolls on its own holds is left out, since a reader
 * reaches it there, and so are the parts of an icon, which turns as it opens.
 */
export function replyOverflow(page: Page) {
  return page.evaluate(() => {
    const edge = document.documentElement.clientWidth;
    const reach = [
      ...document.querySelectorAll(
        '[data-slot="message-activity"] *, [data-slot="message-response"] *'
      ),
    ]
      .filter(
        (element) => !element.closest('[data-slot="scroll-area-viewport"], svg')
      )
      .map((element) => element.getBoundingClientRect().right - edge);
    return Math.max(0, ...reach);
  });
}
