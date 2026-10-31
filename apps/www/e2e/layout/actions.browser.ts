import { expect, test } from "@playwright/test";
import { LESSON_PATH } from "@/e2e/support/chat";

const PAGES = [
  "/en",
  "/en/pricing",
  "/en/try-out",
  "/en/quran",
  "/en/quran/2",
  LESSON_PATH,
];
const WIDTHS = [390, 1440];
/** The most actions a row shows on its own. More go in a group or in a menu. */
const MOST_ACTIONS = 2;
/** Where many links are the content itself, or where a group joins them into one control. */
const LISTS =
  '[data-slot="button-group"],[data-slot="sidebar"],[data-slot="toggle-group"],[role="menu"],[role="tablist"],[role="toolbar"],footer,nav,ol,table,ul';

/**
 * A row holds at most two visible actions, and a third goes into a group with one
 * of them (owner, 31 Oct). Each row is read from the page, so a new band or header
 * answers to the rule without being named here. Two actions a line apart are two
 * rows, so only actions that share a line count.
 */
for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} shows no row of more than two actions at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(path);
      const rows = await page.evaluate(
        ({ lists, most }) => {
          const isAction = (element: Element) =>
            (element.tagName === "A" || element.tagName === "BUTTON") &&
            element.getClientRects().length > 0;
          return [...document.querySelectorAll("body *")].flatMap((row) => {
            const { display } = getComputedStyle(row);
            if (!display.endsWith("flex") || row.closest(lists)) {
              return [];
            }
            const actions = [...row.children]
              .flatMap((child) =>
                getComputedStyle(child).display === "contents"
                  ? [...child.children]
                  : [child]
              )
              .filter(isAction);
            const lines = new Set(
              actions.map((action) =>
                Math.round(action.getBoundingClientRect().top / 16)
              )
            );
            return actions.length > most && lines.size === 1
              ? [actions.map((action) => action.textContent?.trim())]
              : [];
          });
        },
        { lists: LISTS, most: MOST_ACTIONS }
      );

      expect(rows).toStrictEqual([]);
    });
  }
}
