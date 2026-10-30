import { expect, type Page, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A phone-wide and a desktop window. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

// Chromium's classic scrollbars, as Windows and Linux draw them, which would take the page's width.
test.use({
  launchOptions: {
    args: ["--disable-features=OverlayScrollbar"],
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
});

/** How far the page has scrolled, and how far it can. */
const scrollOf = (page: Page) =>
  page.evaluate(() => ({
    end: document.documentElement.scrollHeight - window.innerHeight,
    top: window.scrollY,
  }));

/** Opens a long lesson, with no control holding the focus, so the keys scroll the page itself. */
async function openLesson(page: Page) {
  await page.goto(pinnedRoutes.material.en);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

for (const viewport of WIDTHS) {
  test.describe(`the page's own scrollbar at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("takes no room, takes no focus, and leaves the page its own scrolling", async ({
      page,
    }) => {
      await openLesson(page);
      const bar = page.locator('[data-slot="page-scrollbar"]');

      // Decorative to assistive technology, and never a focus stop.
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      expect(
        await bar.evaluate(
          (element) =>
            element instanceof HTMLElement &&
            element.tabIndex < 0 &&
            element.querySelector("a, button, input, [tabindex]") === null
        )
      ).toBe(true);

      // No gutter, whether the page scrolls or not, and nothing past the window's side.
      expect(
        await page.evaluate(() => {
          const root = document.documentElement;
          const long = root.clientWidth;
          document.body.style.display = "none";
          const short = root.clientWidth;
          document.body.style.display = "";
          return {
            long: window.innerWidth - long,
            short: window.innerWidth - short,
            sideways: root.scrollWidth - root.clientWidth,
          };
        })
      ).toEqual({ long: 0, short: 0, sideways: 0 });

      // The keys scroll the page as they always do, and the thumb follows to the end.
      await page.keyboard.press("End");
      await expect
        .poll(async () => {
          const { end, top } = await scrollOf(page);
          return end - top;
        })
        .toBeLessThanOrEqual(1);
      await expect(bar).toHaveAttribute("data-scrolling", "");
      const thumb = bar.locator("div").first();
      await expect
        .poll(async () => {
          const box = await thumb.boundingBox();
          return viewport.height - (box?.y ?? 0) - (box?.height ?? 0);
        })
        .toBeLessThanOrEqual(4);
      await page.keyboard.press("Home");
      await expect.poll(async () => (await scrollOf(page)).top).toBe(0);
      await page.keyboard.press("PageDown");
      await expect
        .poll(async () => (await scrollOf(page)).top)
        .toBeGreaterThan(0);
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      await expect
        .poll(async () => (await scrollOf(page)).top)
        .toBeGreaterThan(0);

      // An anchor still brings its heading into view.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => {
        const heading = document.querySelector("main h2[id]");
        if (heading !== null) {
          window.location.hash = heading.id;
        }
      });
      await expect
        .poll(async () => (await scrollOf(page)).top)
        .toBeGreaterThan(0);
    });

    test("drags the page by its thumb, stands at the inline end, and shows without a fade when motion is reduced", async ({
      page,
    }) => {
      await openLesson(page);
      const bar = page.locator('[data-slot="page-scrollbar"]');
      const thumb = bar.locator("div").first();

      // The thumb drags the page down.
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await thumb.boundingBox();
      const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
      const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 200, { steps: 5 });
      await page.mouse.up();
      await expect
        .poll(async () => (await scrollOf(page)).top)
        .toBeGreaterThan(0);

      // It stands at the inline end: the right edge, and the left one in a right-to-left page.
      expect(
        await bar.evaluate((element) => element.getBoundingClientRect().right)
      ).toBe(viewport.width);
      await page.evaluate(() => {
        document.documentElement.dir = "rtl";
      });
      expect(
        await bar.evaluate((element) => element.getBoundingClientRect().left)
      ).toBe(0);
      await page.evaluate(() => {
        document.documentElement.dir = "ltr";
      });

      // A reader who asks for less motion gets the bar without a fade.
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await bar.evaluate(
          (element) => getComputedStyle(element).transitionProperty
        )
      ).toBe("none");
    });
  });
}
