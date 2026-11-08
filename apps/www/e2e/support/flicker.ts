import { type BrowserContext, expect, type Page } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";

/** Everything that opens over a page. */
export const POPUPS = Arr.join(
  [
    '[data-slot="dialog-content"]',
    '[data-slot="sheet-popup"]',
    '[data-slot="drawer-content"]',
    '[data-slot="popover-content"]',
    '[data-slot="dropdown-menu-content"]',
    '[data-slot="select-content"]',
  ],
  ","
);

/** What a page draws in place of content that is not ready: a flicker once the content showed. */
const FALLBACKS = '[data-slot="skeleton"], [data-slot="spinner"]';

/** The page global that holds what moved since the walk last read it. */
const MOVES = "nakafaMoves";

/** The page global that holds what blanked or fell back since the walk last read it. */
const FLICKERS = "nakafaFlickers";

/**
 * What a reader's eye follows: a move of one of these is a shift, whatever the browser reports. A menu or
 * a dialog stands in a portal, outside them, so a popup that opens moves none of them.
 */
const WATCHED = Arr.join(
  [
    '[data-slot="page-header"] a',
    '[data-slot="page-header"] button',
    '[data-slot="sidebar-content"] a',
    "main h1",
    "main h2",
    "main th",
    "main a",
    "main button",
    "main input",
    "main p",
  ],
  ","
);

/**
 * Records every frame, before the page's scripts run, each watched element that moved more than a
 * pixel from the frame before with no animation running. Firefox and WebKit report no layout shift
 * entries, so this is how a shift shows in them. The page serializes this function.
 */
function recordMoves({ key, watched }: { key: string; watched: string }) {
  // Under this a font's or a column's rounding shows: 1.5 to 4.6 px measured in WebKit and Firefox.
  const NOTICED = 5;
  const moves: string[] = [];
  Reflect.set(window, key, moves);
  const places = new WeakMap<Element, { x: number; y: number }>();
  // The page serializes this function, so its helpers live inside it.
  const isShown = (item: Element, box: DOMRect) =>
    box.height !== 0 &&
    box.top <= window.innerHeight &&
    box.bottom >= 0 &&
    item.checkVisibility({
      opacityProperty: true,
      visibilityProperty: true,
    });
  // A table that scrolls moves its cells, which a press on a far column does and no reader calls a shift.
  // A cell sticky to a side holds its place through that scroll, so the scroller's distance is not part of its place.
  const scrolledBy = (item: Element) => {
    let scrolled = 0;
    let pinned = false;
    for (let node: Element | null = item; node; node = node.parentElement) {
      scrolled += pinned || node === item ? 0 : node.scrollLeft;
      const style = getComputedStyle(node);
      pinned ||=
        style.position === "sticky" &&
        (style.left !== "auto" || style.right !== "auto");
    }
    return scrolled;
  };
  const follow = () => {
    const still = document.getAnimations().length === 0;
    for (const item of document.querySelectorAll(watched)) {
      const box = item.getBoundingClientRect();
      if (!isShown(item, box)) {
        continue;
      }
      const x = box.x + scrolledBy(item);
      const before = places.get(item);
      places.set(item, { x, y: box.y });
      const across = Math.abs((before?.x ?? x) - x);
      const down = Math.abs((before?.y ?? box.y) - box.y);
      if (still && Math.max(across, down) > NOTICED) {
        moves.push(
          `"${item.textContent?.trim().slice(0, 24)}" ${across.toFixed(1)} across ${down.toFixed(1)} down`
        );
      }
    }
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
}

/**
 * Records, before the page's scripts run, every change that blanks what a reader already saw: the
 * page's main region, or the body of a popup that stands open, losing all its words once it held some,
 * and a fallback (a skeleton or a spinner) that draws once content has shown. A page that draws its
 * content whole in its first paint, and keeps it through every load, records nothing. The page
 * serializes this function.
 */
function recordFlickers({
  fallbacks,
  key,
  popups,
}: {
  fallbacks: string;
  key: string;
  popups: string;
}) {
  const flickers: string[] = [];
  Reflect.set(window, key, flickers);
  // Each region that has shown words, and each fallback already reported.
  const shown = new WeakSet<Element>();
  const reported = new WeakSet<Element>();
  let painted = false;
  const regions = () => [
    ...Array.from(document.querySelectorAll("main")),
    ...Array.from(document.querySelectorAll(popups)),
  ];
  const name = (region: Element) =>
    region.getAttribute("data-slot") ?? region.tagName.toLowerCase();
  const check = () => {
    for (const region of regions()) {
      const words = (region.textContent ?? "").trim().length > 0;
      if (words) {
        shown.add(region);
        painted = true;
      } else if (shown.has(region)) {
        flickers.push(`${name(region)} went blank`);
        shown.delete(region);
      }
    }
    if (!painted) {
      return;
    }
    for (const fallback of document.querySelectorAll(fallbacks)) {
      if (!reported.has(fallback) && fallback.checkVisibility()) {
        reported.add(fallback);
        flickers.push(`drew a fallback: ${name(fallback)}`);
      }
    }
  };
  new MutationObserver(check).observe(document, {
    characterData: true,
    childList: true,
    subtree: true,
  });
}

/** Records moves and flickers in every page of a context, from the first script of each document on. */
export const recordSteadiness = async (context: BrowserContext) => {
  await context.addInitScript(recordMoves, { key: MOVES, watched: WATCHED });
  await context.addInitScript(recordFlickers, {
    fallbacks: FALLBACKS,
    key: FLICKERS,
    popups: POPUPS,
  });
};

/** Takes what the page global `key` holds since the last read. */
const takeFrom = (page: Page, key: string) =>
  page.evaluate((global) => {
    const items = Reflect.get(window, global);
    return Array.isArray(items)
      ? items.splice(0).map((item) => String(item))
      : [];
  }, key);

/** Takes what moved since the last read. */
export const takeMoves = (page: Page) => takeFrom(page, MOVES);

/** Takes what blanked or fell back since the last read. */
export const takeFlickers = (page: Page) => takeFrom(page, FLICKERS);

/**
 * Checks, as soft failures, that the page held still while it loaded: no watched element moved, the
 * browser reported no layout shift, and nothing that had shown went blank or fell back.
 */
export const expectSteady = async (page: Page, label: string) => {
  expect.soft(await takeMoves(page), `${label}: holds still`).toEqual([]);
  expect
    .soft(await takeFlickers(page), `${label}: never blanks or falls back`)
    .toEqual([]);
  expect
    .soft(
      await Effect.runPromise(readCumulativeLayoutShift(page)),
      `${label}: moves nothing`
    )
    .toBe(0);
};

/**
 * Loads the page again three ways a reader does, a hard reload, a step back and a step forward, and
 * checks that each holds still and never blanks. `previous` is the page the reader came from, which
 * the step back returns to; the first page of a tab has none, and only reloads.
 */
export const expectSteadyReloads = async (
  page: Page,
  label: string,
  previous: boolean
) => {
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expectSteady(page, `${label} after a reload`);
  if (!previous) {
    return;
  }
  await page.goBack();
  await page.waitForLoadState("networkidle");
  await expectSteady(page, `${label} back to the page before`);
  await page.goForward();
  await page.waitForLoadState("networkidle");
  await expectSteady(page, `${label} forward again`);
};
