// Takes the pictures of the landing branch (nabil/landing-quality, with the
// visual card branch merged in): every section of the home and pricing pages,
// the home page's DOM budgets, and the five-band visual cards on lessons, inline,
// playing and full screen. Copy it to apps/www/e2e/marketing/zshots.browser.ts
// of that worktree and run it in the visual project (never commit it).
import { writeFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { measureMarketingPage } from "@/e2e/support/marketing";
import { openRoute } from "@/e2e/support/route";
import { MARKETING_PAGE } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { targetViewports } from "@/e2e/support/viewport";

const SHOTS = process.env.SHOTS_DIR ?? "";

async function openHome(page: Page) {
  await Effect.runPromise(openRoute(page, "/en", "denied"));
  await expect(page.locator(MARKETING_PAGE).filter({ visible: true })).toHaveCount(
    1,
    { timeout: readinessTimeoutMilliseconds }
  );
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
  for (const [name, path] of [["home", "/en"], ["pricing", "/en/pricing"]] as const) {
  test.describe(`${name} sections ${width} ${theme}`, () => {
    test.use({
      colorScheme: theme,
      viewport: { height: width === 390 ? 844 : 900, width },
    });

    test(`every ${name} section at ${width} in ${theme}`, async ({ page }) => {
      test.setTimeout(600_000);
      await Effect.runPromise(openRoute(page, path, "denied"));
      await expect(page.locator(MARKETING_PAGE).filter({ visible: true })).toHaveCount(1, { timeout: readinessTimeoutMilliseconds });
      await page.evaluate(() => document.fonts.ready);
      // The toy layer loads after the page; every picture waits for its toys.
      await page
        .waitForFunction(
          () =>
            document.querySelectorAll(".group\\/toy:not([hidden])").length >= 4,
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

const CONSENT = JSON.stringify({ category: "analytics", decidedAt: 1, decision: "denied", mechanism: "privacy-controls", noticeVersion: "privacy-2026-08-22" });
const VISUALS = [
  { name: "lab", route: pinnedRoutes.exponent.en, content: "[data-bacteria-count]" },
  { name: "chart", route: pinnedRoutes.growth.en, content: '[data-slot="chart"]' },
  { name: "scene", route: pinnedRoutes.material.en, content: '[data-scene="line"]' },
];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
}

async function shootCard(page: Page, card: Locator, name: string) {
  await card.scrollIntoViewIfNeeded();
  await card.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await settle(page);
  await card.screenshot({ path: `${SHOTS}/${name}.png` });
}

for (const width of [390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${width} ${theme}`, () => {
      test.use({ colorScheme: theme, viewport: { height: 900, width } });
      test(`visual cards at ${width} in ${theme}`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.addInitScript((consent) => localStorage.setItem("nakafa-analytics-consent", consent), CONSENT);
        let index = 1;
        for (const visual of VISUALS) {
          await page.goto(visual.route);
          const card = page
            .locator('[data-slot="visual-card"] > [data-slot="card"]')
            .filter({ has: page.locator(visual.content) })
            .first();
          await expect(async () => {
            await card.scrollIntoViewIfNeeded();
            await expect(card.locator(visual.content).first()).toBeVisible();
          }).toPass({ timeout: 60_000 });
          const prefix = `${width}-${theme}-${String(index).padStart(2, "0")}`;
          await shootCard(page, card, `${prefix}-${visual.name}`);
          if (visual.name === "scene") {
            await card.getByRole("button", { name: "Play", exact: true }).click();
            await page.waitForTimeout(2500);
            await card.screenshot({ path: `${SHOTS}/${prefix}-scene-playing.png` });
            await card.getByRole("button", { name: "Play", exact: true }).click();
          }
          await card.getByRole("button", { name: "Full screen", exact: true }).click();
          await settle(page);
          await page.screenshot({ path: `${SHOTS}/${prefix}-${visual.name}-full.png` });
          await page.keyboard.press("Escape");
          await settle(page);
          await page.screenshot({ path: `${SHOTS}/${prefix}-${visual.name}-after.png` });
          index += 1;
        }
      });
    });
  }
}
