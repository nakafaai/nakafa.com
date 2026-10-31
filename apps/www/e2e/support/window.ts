import { expect, type Locator, type Page } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { LAST_SERVER, NEWEST } from "@/e2e/support/list";
import { MEMORY_PATH, memoryRow } from "@/e2e/support/memory";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Where one row of the list stands in the document, or none when it is not in the page. */
const placeOf = (page: Page, text: string) =>
  page.evaluate((needle) => {
    const row = [...document.querySelectorAll("main ul > li")].find((item) =>
      item.textContent?.includes(needle)
    );
    if (!row) {
      return null;
    }
    const box = row.getBoundingClientRect();
    return {
      height: box.height,
      left: box.left,
      top: box.top + window.scrollY,
      width: box.width,
    };
  }, text);

/** How many rows of the page hold more than the height they are given. */
const overflowingRows = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("main ul > li")].filter(
        (item) => item.scrollHeight > item.clientHeight
      ).length
  );

/** The first row of the memory list. */
export const firstRow = (page: Page) => page.locator("main ul > li").first();

/** Whether React has hydrated an element, which attaches its fiber to the node. */
const hasReactFiber = (element: Element) =>
  Object.keys(element).some((key) => key.startsWith("__reactFiber"));

/** Whether React has taken over the element that a locator finds. */
export const isHydrated = (target: Locator) => target.evaluate(hasReactFiber);

/**
 * Whether React has taken over one element, which it does when it hydrates the
 * element. Until then React cannot run the element's handlers, and a press on it
 * can be lost.
 */
export const isTakenOver = (element: Locator) =>
  element.evaluate((node) =>
    Object.keys(node).some((key) => key.startsWith("__reactFiber"))
  );

/**
 * Waits until React has taken over a control that the server drew. Until then the control has no
 * handler: a press on a button opens nothing, and a press on a form's button submits the form
 * natively and loads the page again. A form waits before the test fills it, so React holds what
 * the test types.
 */
export const waitUntilTakenOver = (control: Locator) =>
  expect
    .poll(() => isTakenOver(control), { timeout: readinessTimeoutMilliseconds })
    .toBe(true);

/**
 * Loads the Memory page and notes where the newest row and the last row of the
 * first page stand in the first frame that draws them both, then checks that
 * they stand in the same places once the page has settled, and once the window
 * has taken the last of them in and out of the page. The account screens render
 * in the browser only (ADR 0038 D2), so that first frame is the window's first
 * render, which places every row of the first page at a multiple of its height.
 * The page says nothing in its console on the way.
 */
export const drawsInPlace = Effect.fn("NakafaE2E.drawsInPlace")(function* (
  page: Page
) {
  yield* Effect.promise(async () => {
    const said = MutableList.make<string>();
    const listen = (message: { text: () => string; type: () => string }) => {
      if (message.type() === "error" || message.type() === "warning") {
        MutableList.append(said, `${message.type()}: ${message.text()}`);
      }
    };

    page.on("console", listen);
    const watch = await page.addInitScript(
      ({ newest, last }) => {
        const place = (needle: string) => {
          const row = [...document.querySelectorAll("main ul > li")].find(
            (item) => item.textContent?.includes(needle)
          );
          if (!row) {
            return null;
          }
          const box = row.getBoundingClientRect();
          return {
            height: box.height,
            left: box.left,
            top: box.top + window.scrollY,
            width: box.width,
          };
        };
        const look = () => {
          const first = place(newest);
          const end = place(last);
          if (first && end) {
            Reflect.set(window, "nakafaFirstPlaces", { end, first });
            return;
          }
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      },
      { last: LAST_SERVER, newest: NEWEST }
    );
    await page.goto(MEMORY_PATH);
    await expect(memoryRow(page, LAST_SERVER)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.waitForLoadState("networkidle");
    const drawn = await page.evaluate(() =>
      Reflect.get(window, "nakafaFirstPlaces")
    );
    expect(drawn).toEqual({
      end: await placeOf(page, LAST_SERVER),
      first: await placeOf(page, NEWEST),
    });
    const last = await placeOf(page, LAST_SERVER);

    // Scrolling to the last row takes the rows above it out of the page, and
    // it stands where it stood.
    await page.evaluate((top) => window.scrollTo(0, top - 300), last?.top ?? 0);
    await expect(memoryRow(page, LAST_SERVER)).toBeVisible();
    await expect(memoryRow(page, NEWEST)).toHaveCount(0);
    expect(await placeOf(page, LAST_SERVER)).toEqual(last);
    expect(MutableList.toArray(said)).toEqual([]);

    page.off("console", listen);
    await watch.dispose();
    await page.evaluate(() => window.scrollTo(0, 0));
  });
});

/**
 * The same check with the text of the page half as large again from its first
 * paint. Every row has one fixed height in pixels, so the window knows where
 * each row stands at any text size. A height that follows the text would not
 * match the places the window gives the rows before it has measured any. At
 * this size the two lines of every row still fit in that height.
 */
export const drawsInPlaceAtLargeText = Effect.fn(
  "NakafaE2E.drawsInPlaceAtLargeText"
)(function* (page: Page) {
  const larger = yield* Effect.promise(() =>
    page.addInitScript(() => {
      const apply = () => {
        const style = document.createElement("style");
        style.textContent = "html { font-size: 150% !important; }";
        document.documentElement.append(style);
      };

      // The script can run before the page has an html element.
      if (document.documentElement) {
        apply();
        return;
      }
      new MutationObserver((_records, observer) => {
        if (document.documentElement) {
          observer.disconnect();
          apply();
        }
      }).observe(document, { childList: true });
    })
  );

  yield* drawsInPlace(page);
  yield* Effect.promise(async () => {
    const rootSize = await page.evaluate(
      () => getComputedStyle(document.documentElement).fontSize
    );

    expect(rootSize).toBe("24px");
    // The rows at the top are back in the page, and none holds more than its height.
    await expect(memoryRow(page, NEWEST)).toBeVisible();
    expect(await overflowingRows(page)).toBe(0);
    await larger.dispose();
  });
});

/** What holds the focus: its accessible name, and whether it sits in the list. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement;
    return {
      inList: Boolean(element?.closest("main ul")),
      name: element?.getAttribute("aria-label") ?? element?.textContent ?? "",
    };
  });

/**
 * Tab reaches the main press, the Edit and the Delete of each row in turn, and
 * a row the window takes out of the page while it holds the focus leaves the
 * focus in the list: the next Tab goes on to a row of the page.
 */
export const reachesRows = Effect.fn("NakafaE2E.reachesRows")(function* (
  page: Page
) {
  yield* Effect.promise(async () => {
    const search = page.getByRole("searchbox", { name: "Search memories" });

    // The window brings the first rows in a moment after the page scrolled to
    // them, and a Tab pressed before that would reach the rows it still holds.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(memoryRow(page, NEWEST)).toBeVisible();
    await search.focus();
    await page.keyboard.press("Tab");
    expect((await focused(page)).name).toBe("Add memory");
    for (const name of [NEWEST, "Edit memory", "Delete memory"]) {
      await page.keyboard.press("Tab");
      expect((await focused(page)).name).toContain(name);
    }
    await page.keyboard.press("Tab");
    expect((await focused(page)).inList).toBe(true);

    // The window takes the focused row out of the page, and the list keeps the focus.
    await memoryRow(page, NEWEST)
      .getByRole("button", { name: "Edit memory" })
      .focus();
    await page.mouse.wheel(0, 2400);
    await expect(memoryRow(page, NEWEST)).toHaveCount(0);
    expect((await focused(page)).inList).toBe(true);
    await page.keyboard.press("Tab");
    expect(await focused(page)).toMatchObject({ inList: true });
    await page.evaluate(() => window.scrollTo(0, 0));
  });
});
