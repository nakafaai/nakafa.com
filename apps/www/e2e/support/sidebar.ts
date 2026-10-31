import { expect, type Page } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** Two phones, a tablet, and two desktops: below 1024 px the sidebar is a sheet, from it a panel beside the page. */
const SIDEBAR_WIDTHS = [320, 390, 768, 1024, 1440] as const;

/** The width from which the sidebar stands beside the page, and folds into a rail of its icons. */
const BESIDE = 1024;

/** The width of the sidebar folded into its rail, in pixels: `w-12`. */
const RAIL = 48;

/** The name of every sidebar toggle. */
const TOGGLE = en.Common["toggle-sidebar"];

/**
 * Every part of the shown sidebar that runs wider than its own box: the panel, its inner surface and each scroller
 * in it, as `part: scrollWidth > clientWidth`, followed by the unclipped elements that cross the panel's inside
 * edge, which name the cause. A tidy sidebar has none, so it never scrolls sideways.
 */
function readSideways(page: Page) {
  return page.evaluate(() => {
    const shown = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="sidebar-container"], [data-mobile="true"][data-slot="sidebar"]'
      )
    ).find((element) => element.getBoundingClientRect().width > 0);
    if (shown === undefined) {
      return ["no sidebar shows"];
    }
    const parts = [
      shown,
      ...Array.from(
        shown.querySelectorAll<HTMLElement>(
          '[data-slot="sidebar-inner"], [data-slot="scroll-area-viewport"]'
        )
      ),
    ];
    // The inside edge of the panel, before its border, which nothing of it may cross.
    const edge =
      shown.getBoundingClientRect().left + shown.clientLeft + shown.clientWidth;
    // An element inside a part that clips it shows nothing past that part, so only the unclipped ones are named.
    const clipped = (element: HTMLElement) => {
      let parent = element.parentElement;
      while (parent !== null && parent !== shown) {
        if (getComputedStyle(parent).overflowX !== "visible") {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };
    const wide = parts
      .filter((part) => part.scrollWidth !== part.clientWidth)
      .map(
        (part) =>
          `${part.dataset.slot}: ${part.scrollWidth} > ${part.clientWidth}`
      );
    const past = Array.from(shown.querySelectorAll<HTMLElement>("*"))
      .filter(
        (element) =>
          element.getBoundingClientRect().right > edge + 0.5 &&
          !clipped(element)
      )
      .slice(0, 5)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}[${element.dataset.slot ?? element.dataset.sidebar ?? ""}] "${(element.textContent ?? "").trim().slice(0, 24)}" ends ${Math.round(element.getBoundingClientRect().right - edge)}px past the edge`
      );
    return wide.length === 0 ? [] : [...wide, ...past];
  });
}

/**
 * Walks the sidebar of the page at `address` through every width and state it takes: the sheet below 1024 px,
 * opened from the page header, and from 1024 px the open panel and its rail. In each one no part of the sidebar
 * runs wider than its box. The page's context keeps its session, so a signed-in surface stays signed in.
 */
export const expectNoSidewaysSidebar = Effect.fn(
  "NakafaE2E.expectNoSidewaysSidebar"
)(function* (page: Page, address: string) {
  for (const width of SIDEBAR_WIDTHS) {
    yield* Effect.promise(async () => {
      await page.setViewportSize({ height: 844, width });
      await page.goto(address);
      if (width < BESIDE) {
        const open = page
          .locator('[data-sidebar="trigger"]')
          .filter({ visible: true })
          .first();
        await waitUntilTakenOver(open);
        await open.click();
        await expect(
          page.locator('[data-mobile="true"][data-slot="sidebar"]')
        ).toBeVisible();
        expect(await readSideways(page), `the sheet at ${width}px`).toEqual([]);
        await page.keyboard.press("Escape");
        return;
      }
      const sidebar = page.locator('[data-slot="sidebar-container"]').first();
      const toggle = sidebar.getByRole("button", { exact: true, name: TOGGLE });
      await waitUntilTakenOver(toggle);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(await readSideways(page), `the panel at ${width}px`).toEqual([]);
      await toggle.click();
      await expect
        .poll(async () => (await sidebar.boundingBox())?.width)
        .toBe(RAIL);
      expect(await readSideways(page), `the rail at ${width}px`).toEqual([]);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    });
  }
});
