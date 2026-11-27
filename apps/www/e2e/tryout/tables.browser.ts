import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { DARMSTADT, TKA_GRADE, trackHref, visit } from "@/e2e/support/tryout";

/** The head of a set table's level column, whose button opens its filter. */
const LEVEL_HEAD = /Level/u;
/**
 * The set tables the owner checks: SNBT's one track, whose Indonesian states are
 * the longest, and TKA's compulsory mathematics, where the columns went missing.
 */
const SET_TABLES = [
  trackHref,
  trackHref.replace("/en/", "/id/"),
  `${TKA_GRADE}/compulsory-mathematics`,
  "/id/try-out/indonesia/tka/sma-ma-smk/matematika-wajib",
] as const;
/** The widths at which the set table keeps every column: two phones and a desktop. */
const TABLE_WIDTHS = [320, 390, 1440] as const;

/**
 * One table at every width (the owner's rule): every column of a track's sets
 * stands on a phone as on a desktop, Level, Questions, Minutes and Score
 * included, and a card narrower than its columns scrolls them sideways inside
 * itself, under the row's menu, while the page never scrolls sideways. So no head
 * is hidden or zero wide, every row holds a cell under every head, the table's
 * scroll stays inside the card's edges, and once scrolled to its end the last
 * column stands whole beside the menu. Each state badge draws its name whole or
 * cut with an ellipsis inside the badge.
 */
for (const href of SET_TABLES) {
  for (const width of TABLE_WIDTHS) {
    test(`${href} keeps every column of its set table at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 800, width });
      await visit(page, href);
      const card = page.locator('[data-slot="table-card"]');
      await expect(card.locator("tbody tr a[href]").first()).toBeVisible();
      const table = await card.evaluate((element) => {
        const edges = element.getBoundingClientRect();
        const viewport = element.querySelector<HTMLElement>(
          '[data-slot="scroll-area-viewport"]'
        );
        const heads = Array.from(
          element.querySelectorAll<HTMLElement>("thead th")
        );
        const shown = (cell: Element) =>
          getComputedStyle(cell).display !== "none" &&
          cell.getBoundingClientRect().width > 0;
        const hidden = heads
          .filter((head) => !shown(head))
          .map((head, index) => head.textContent?.trim() || `head ${index}`);
        const rows = Array.from(element.querySelectorAll("tbody tr"));
        const short = rows.filter(
          (row) =>
            Array.from(row.querySelectorAll("td")).filter(shown).length !==
            heads.length
        ).length;
        const box = viewport?.getBoundingClientRect();
        const scrolls =
          viewport !== null && viewport.scrollWidth > viewport.clientWidth;
        if (viewport !== null) {
          viewport.scrollLeft = viewport.scrollWidth;
        }
        const last = heads.at(-2)?.getBoundingClientRect();
        const menu = heads.at(-1)?.getBoundingClientRect();
        const badges = Array.from(
          element.querySelectorAll<HTMLElement>(
            "[data-progress] [data-slot=badge]"
          )
        ).filter((badge) => {
          const name = badge.querySelector<HTMLElement>(".truncate");
          return !(
            badge.scrollWidth <= badge.clientWidth &&
            (name === null ||
              name.scrollWidth <= name.clientWidth ||
              getComputedStyle(name).textOverflow === "ellipsis")
          );
        }).length;
        const frame = element.closest('[data-slot="page-list"]');
        const padding =
          frame === null
            ? 0
            : Number.parseFloat(getComputedStyle(frame).paddingBottom);
        return {
          clearance: window.innerHeight - edges.bottom - padding,
          pageScroll:
            document.documentElement.scrollHeight - window.innerHeight,
          cutBadges: badges,
          heads: heads.length,
          hidden,
          inside:
            box !== undefined &&
            box.left >= edges.left - 0.5 &&
            box.right <= edges.right + 0.5,
          lastBesideMenu:
            last !== undefined &&
            menu !== undefined &&
            last.right <= menu.left + 0.5,
          rows: rows.length,
          scrolls,
          short,
        };
      });

      // Six columns of data and the row's menu.
      expect(table.heads).toBe(7);
      expect(table.hidden).toEqual([]);
      expect(table.rows).toBeGreaterThan(0);
      expect(table.short).toBe(0);
      expect(table.inside).toBe(true);
      expect(Math.abs(table.clearance)).toBeLessThanOrEqual(1);
      expect(table.pageScroll).toBeLessThanOrEqual(1);
      expect(table.lastBesideMenu).toBe(true);
      expect(table.cutBadges).toBe(0);
      // On a phone the card must scroll. A desktop may also scroll inside the 3xl column.
      if (width < 768) {
        expect(table.scrolls).toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        )
      ).toBeLessThanOrEqual(0);
    });
  }
}

/**
 * The set tables of every locale, each in its own words for a set: Set 1 in English, Indonesian and Malay, and
 * Aufgabensatz 1 in German, the longest, which a column sized for Set 1 cut to "Aufgabe...".
 */
const NAMED_SET_TABLES = [
  trackHref,
  trackHref.replace("/en/", "/id/"),
  "/ms/try-out/indonesia/tka/sekolah-menengah-atas/matematik-wajib",
  DARMSTADT,
  "/de/try-out/deutschland/aufnahmepruefung/studienkolleg-der-tu-darmstadt/mathematik",
] as const;

/**
 * The owner's notes of 26 and 27 Nov: a track's set table stands at the catalog's width (4xl), and its Name and Status
 * columns stand as wide as the widest thing they draw in the page's language: the longest set name, Aufgabensatz 1 as
 * whole as Set 1, and the widest status badge, Zeit abgelaufen as whole as Completed, with no room to spare. So no name
 * or badge is cut, on a phone the table scrolls sideways inside its card, and on a desktop every column stands whole
 * without scrolling, the spare width shared among the columns.
 */
for (const href of NAMED_SET_TABLES) {
  for (const width of TABLE_WIDTHS) {
    test(`fits the set names and status badges on ${href} at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await visit(page, href);
      const card = page.locator('[data-slot="table-card"]');
      await expect(card.locator("tbody tr a[href]").first()).toBeVisible();
      const table = await card.evaluate((element) => {
        const viewport = element.querySelector<HTMLElement>(
          '[data-slot="scroll-area-viewport"]'
        );
        const inner = (cell: Element) => {
          const style = getComputedStyle(cell);
          return (
            cell.getBoundingClientRect().width -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight)
          );
        };
        const widest = (parts: readonly Element[]) =>
          Math.max(
            0,
            ...parts.map((part) => part.getBoundingClientRect().width)
          );
        const heads = Array.from(element.querySelectorAll("thead th"));
        const status = heads.find(
          (head) =>
            head.querySelector("[aria-hidden] [data-slot=badge]") !== null
        );
        // A name's link fills its cell, so what it draws ends where its words end: its mark, then its name.
        const names = Array.from(
          element.querySelectorAll("tbody td:first-child a[href]"),
          (link) =>
            (link.querySelector(".truncate")?.getBoundingClientRect().right ??
              0) - link.getBoundingClientRect().left
        );
        const words = Array.from(
          element.querySelectorAll<HTMLElement>(
            "tbody td:first-child a[href] .truncate, tbody [data-slot=badge] .truncate"
          )
        );
        return {
          cut: words
            .filter((word) => word.scrollWidth > word.clientWidth)
            .map((word) => word.textContent),
          nameSpare:
            heads[0] === undefined
              ? -1
              : inner(heads[0]) - Math.max(0, ...names),
          names: names.length,
          scrolls:
            viewport !== null &&
            viewport.scrollWidth > viewport.clientWidth + 1,
          statusSpare:
            status === undefined
              ? -1
              : inner(status) -
                widest(
                  Array.from(
                    status.querySelectorAll("[aria-hidden] [data-slot=badge]")
                  )
                ),
        };
      });
      expect(table.names).toBeGreaterThan(0);
      expect(table.cut).toEqual([]);
      expect(table.nameSpare).toBeGreaterThanOrEqual(-1);
      expect(table.statusSpare).toBeGreaterThanOrEqual(-1);
      if (width === 1440) {
        expect(table.scrolls).toBe(false);
        return;
      }
      // A phone's table is wider than its card, so no column takes spare width: each stands at what it draws.
      expect(table.nameSpare).toBeLessThanOrEqual(2);
      expect(table.statusSpare).toBeLessThanOrEqual(2);
    });
  }
}

test("the Level filter draws each level with the bars its rows draw", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await visit(page, trackHref);
  const readBarWidths = (scope: ReturnType<Page["locator"]>) =>
    scope
      .locator('span[aria-hidden="true"] > span')
      .evaluateAll((bars) =>
        bars.map((bar) => bar.getBoundingClientRect().width)
      );
  const rowWidths = await readBarWidths(
    page.locator("tbody tr").first().locator("td").nth(1)
  );
  expect(rowWidths).toHaveLength(4);
  expect(Math.min(...rowWidths)).toBeGreaterThanOrEqual(3);
  await page
    .locator("thead")
    .getByRole("button", { name: LEVEL_HEAD })
    .first()
    .click();
  for (const level of ["Easy", "Medium", "Hard", "Cooked"]) {
    const option = page.getByRole("menuitemradio", {
      exact: true,
      name: level,
    });
    await expect(option).toBeVisible();
    const widths = await readBarWidths(option);
    expect(widths).toHaveLength(4);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(1);
  }
});
