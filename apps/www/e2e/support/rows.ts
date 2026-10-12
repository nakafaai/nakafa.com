import type { Locator, Page } from "@playwright/test";

/**
 * The chats of the list in the sidebar beside a chat page. A phone has a second
 * copy of the sidebar, in a sheet, so only the one the learner sees counts.
 */
export const sidebarRows = (page: Page) =>
  page
    .locator('a[data-sidebar="menu-button"][href^="/en/chat/"]')
    .filter({ visible: true });

/** The search box of the sidebar. */
export const sidebarSearch = (page: Page) =>
  page.getByPlaceholder("Search your chats...").filter({ visible: true });

/** The scrolling part of the sidebar that holds the chats. */
export const sidebarScroller = (page: Page) =>
  page
    .locator('[data-slot="sidebar-content"]')
    .filter({ has: page.locator('a[href^="/en/chat/"]') })
    .filter({ visible: true });

/** The chats of the history menu of Nina's sheet. */
export const historyRows = (page: Page) =>
  page.locator('[data-slot="dropdown-menu-content"] [role="menuitem"]');

/** The chats of the chats page of a learner. */
export const pageRows = (page: Page) =>
  page.locator('main main a[href^="/en/chat/"]');

/**
 * Waits until what holds the first row of a list has stopped animating, such
 * as a menu that opens by growing. A row measured while its menu grows stands
 * in a place it leaves a moment later.
 */
export const settled = (rows: Locator) =>
  rows.first().evaluate(async (row) => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect instanceof KeyframeEffect &&
            animation.effect.target?.contains(row)
        )
        .map((animation) => animation.finished)
    );
  });

/** Where every row of a list stands, and how tall it is, from the top of the part that scrolls it. */
export const placesOf = (rows: Locator) =>
  rows.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      const scroller = element.closest(
        '[data-slot="sidebar-content"], [role="menu"]'
      );
      const origin = scroller
        ? scroller.getBoundingClientRect().top - scroller.scrollTop
        : -window.scrollY;
      return { height: box.height, top: box.top - origin };
    })
  );

/**
 * Marks every row of a list as an element of the page. A row that mounted
 * again would be a new element without the mark.
 */
export const markRows = (rows: Locator) =>
  rows.evaluateAll((elements) => {
    for (const element of elements) {
      Reflect.set(element, "marked", true);
    }
  });

/** How many rows of a list are still the elements that `markRows` marked. */
export const markedRows = (rows: Locator) =>
  rows.evaluateAll(
    (elements) =>
      elements.filter((element) => Reflect.get(element, "marked") === true)
        .length
  );

/** Scrolls a list to its end, which brings the end of the list into view. */
export const scrollToEnd = (page: Page, scroller: Locator | undefined) =>
  scroller
    ? scroller.evaluate((element) => {
        element.scrollTo(0, element.scrollHeight);
      })
    : page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );
