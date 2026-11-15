import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { openConsentPreferences } from "@/e2e/support/consent";
import { openRoute } from "@/e2e/support/route";
import { SHEET_POPUP } from "@/e2e/support/selector";
import { openSheet } from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The widths the owner reads every state at: a phone, a tablet and a laptop. */
const WIDTHS = [390, 768, 1440] as const;

/** The two themes every state is read in. */
const SCHEMES = ["light", "dark"] as const;

/** A lesson whose header holds its actions and its outline in one group, and whose visual cards carry a header. */
const LESSON_PATH =
  "/en/subjects/mathematics/exponential-logarithm/basic-concept";

/** An article with bar charts, each of which stops at the chart's maximum height. */
const CHART_PATH = "/en/articles/politics/merah-putih-cabinet-analysis";

/** A search that finds nothing, which shows Nina fishing in its empty state. */
const EMPTY_SEARCH_PATH = "/en/search?q=zzqqxxnothing";

/** Pages whose header holds a search, actions or an outline toggle: each shows two standalone pills at most. */
const HEADER_PATHS = [LESSON_PATH, CHART_PATH, "/en/quran/1"] as const;

/** The tallest a chart draws, Tailwind's `max-h-96`, in pixels. */
const CHART_MAX_HEIGHT = 384;

/** From this width a side sheet resizes from its edge; a phone's sheet fills the screen. */
const SHEET_RESIZE_WIDTH = 640;

/** From this width a dialog is a dialog; below it the same content is a drawer. */
const DIALOG_WIDTH = 768;

/**
 * The standalone pills a page header shows beside its path: each visible button outside a group, and each group as
 * one pill. The sidebar's own toggle at the header's start is the app's frame, not one of the page's pills.
 */
const headerPills = (page: Page) =>
  page.locator('header[data-slot="page-header"]').evaluate((header) => {
    const shown = (element: Element) =>
      element instanceof HTMLElement && element.offsetParent !== null;
    const groups = Array.from(
      header.querySelectorAll('[data-slot="button-group"]')
    ).filter((group) => Array.from(group.children).some(shown));
    const alone = Array.from(
      header.querySelectorAll('button, a[data-slot="button"]')
    ).filter(
      (button) =>
        shown(button) &&
        button.closest('[data-slot="button-group"]') === null &&
        button.closest("nav") === null &&
        button.getAttribute("aria-label") !== "Toggle Sidebar"
    );
    return groups.length + alone.length;
  });

/** Scrolls through the whole page once, so every section that draws when the reader nears it is in the document. */
const nearEverySection = (page: Page) =>
  page.evaluate(async () => {
    for (
      let top = 0;
      top < document.documentElement.scrollHeight;
      top += window.innerHeight
    ) {
      window.scrollTo(0, top);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo(0, 0);
  });

/** Saves one picture of the page, named by the state, the width and the theme. */
async function shoot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
}

for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    test.describe(`The design foundations at ${width} px in ${scheme}`, () => {
      test.use({ colorScheme: scheme, viewport: { height: 900, width } });

      test("a lesson's header groups its actions, and its visual cards carry a title and a description", async ({
        page,
      }) => {
        await Effect.runPromise(openRoute(page, LESSON_PATH, "denied"));
        const header = page
          .locator('header[data-slot="page-header"] [data-slot="button-group"]')
          .first();
        await expect(header).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await shoot(page, `lesson-header-${width}-${scheme}`);
        await nearEverySection(page);
        const card = page.locator('[data-slot="visual-card"]').first();
        await card.scrollIntoViewIfNeeded();
        await expect(card.locator('[data-slot="card-title"]')).toBeVisible();
        await card.screenshot({
          path: test.info().outputPath(`visual-card-${width}-${scheme}.png`),
        });
      });

      test("every page header shows two standalone pills at most", async ({
        page,
      }) => {
        for (const path of HEADER_PATHS) {
          await Effect.runPromise(openRoute(page, path, "denied"));
          await expect(
            page.locator('header[data-slot="page-header"]')
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
          expect(await headerPills(page), path).toBeLessThanOrEqual(2);
          await shoot(page, `header-${path.split("/")[2]}-${width}-${scheme}`);
        }
      });

      test("every chart stops at its maximum height", async ({ page }) => {
        await Effect.runPromise(openRoute(page, CHART_PATH, "denied"));
        await nearEverySection(page);
        const charts = page.locator('[data-slot="chart"]');
        await expect(charts.first()).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        const heights = await charts.evaluateAll((all) =>
          all.map((chart) => chart.getBoundingClientRect().height)
        );
        expect(
          Arr.filter(heights, (height) => height > CHART_MAX_HEIGHT + 1)
        ).toEqual([]);
        await charts.first().scrollIntoViewIfNeeded();
        await shoot(page, `chart-${width}-${scheme}`);
      });

      test("a dialog's footer holds its actions alone, with no Cancel or Close", async ({
        page,
      }) => {
        await Effect.runPromise(openRoute(page, "/en", "denied"));
        const { popup } = await Effect.runPromise(
          openConsentPreferences(
            page,
            width >= DIALOG_WIDTH ? "dialog-content" : "drawer-popup"
          )
        );
        await expect(
          popup.getByRole("button", { exact: true, name: "Cancel" })
        ).toHaveCount(0);
        await shoot(page, `dialog-${width}-${scheme}`);
      });

      test("Nina's sheet resizes from the pane's edge, and its header's icons touch", async ({
        page,
      }) => {
        await Effect.runPromise(openSheet(page));
        const sheet = page.locator(SHEET_POPUP);
        await expect(sheet).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(
          sheet.getByRole("separator", { name: "Change width" })
        ).toBeVisible({ visible: width >= SHEET_RESIZE_WIDTH });
        await shoot(page, `sheet-${width}-${scheme}`);
      });

      test("an empty search shows Nina in its empty state", async ({
        page,
      }) => {
        await Effect.runPromise(openRoute(page, EMPTY_SEARCH_PATH, "denied"));
        const empty = page.locator('main [data-slot="empty"]').first();
        await expect(empty).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(empty.locator("svg").first()).toBeVisible();
        await shoot(page, `empty-${width}-${scheme}`);
      });
    });
  }
}
