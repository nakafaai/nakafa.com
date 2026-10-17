// Measures the home page's DOM budgets (and, below, shoots every section of
// the home and pricing pages once their demos have run) on a production build, with the same
// reader the surfaces test uses, at every target viewport, and writes each to
// SHOTS_DIR/measure-<viewport>.json. It also shoots the parts that draw animals
// and Nina's face (the crowd, the school band, the founder's note) at 390 and
// 1440 px in both themes, so their shapes can be checked. Copy it to
// apps/www/e2e/marketing/zshots.browser.ts of that worktree (never commit it).
import { writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { measureMarketingPage } from "@/e2e/support/marketing";
import { openRoute } from "@/e2e/support/route";
import { MARKETING_PAGE } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { targetViewports } from "@/e2e/support/viewport";

const SHOTS = process.env.SHOTS_DIR ?? "";

async function openHome(page: Page) {
  await Effect.runPromise(openRoute(page, "/en", "denied"));
  await expect(
    page.locator(MARKETING_PAGE).filter({ visible: true })
  ).toHaveCount(1, { timeout: readinessTimeoutMilliseconds });
  await page.evaluate(() => document.fonts.ready);
}

for (const viewport of targetViewports) {
  test.describe(`measure at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test(`home budgets at ${viewport.name}`, async ({ page }) => {
      await openHome(page);
      const measured = await Effect.runPromise(measureMarketingPage(page));
      writeFileSync(
        `${SHOTS}/measure-${viewport.name}.json`,
        JSON.stringify(measured, null, 2)
      );
    });
  });
}

for (const [width, theme] of [
  [1440, "light"],
  [1440, "dark"],
  [390, "light"],
] as const) {
  for (const [name, path] of [
    ["home", "/en"],
    ["pricing", "/en/pricing"],
  ] as const) {
    test.describe(`${name} sections ${width} ${theme}`, () => {
      test.use({
        colorScheme: theme,
        viewport: { height: width === 390 ? 844 : 900, width },
      });

      test(`every ${name} section at ${width} in ${theme}`, async ({
        page,
      }) => {
        test.setTimeout(600_000);
        await Effect.runPromise(openRoute(page, path, "denied"));
        await expect(
          page.locator(MARKETING_PAGE).filter({ visible: true })
        ).toHaveCount(1, { timeout: readinessTimeoutMilliseconds });
        await page.evaluate(() => document.fonts.ready);
        // The toy layer loads after the page; every picture waits for its toys.
        await page
          .waitForFunction(
            () =>
              document.querySelectorAll(".group\\/toy:not([hidden])").length >=
              4,
            undefined,
            { timeout: 60_000 }
          )
          .catch(() => undefined);
        const sections = page.locator(`${MARKETING_PAGE} section`);
        const count = await sections.count();
        for (let index = 0; index < count; index++) {
          const section = sections.nth(index);
          if (!(await section.isVisible())) {
            continue;
          }
          const part =
            (await section.getAttribute("id")) ?? `section-${index + 1}`;
          await section.evaluate((element) =>
            element.scrollIntoView({ block: "center" })
          );
          await page.mouse.move(0, 0);
          await page.waitForTimeout(4500);
          await page.screenshot({
            path: `${SHOTS}/${name}-${width}-${theme}-${String(index + 1).padStart(2, "0")}-${part}.png`,
          });
        }
      });
    });
  }
}
