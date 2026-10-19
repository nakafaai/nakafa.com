import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

/** The sidebar of the school, whose links every click below starts from. */
const SIDEBAR = '[data-slot="sidebar-content"]';

/** The sidebar items of a manager's school, each by the address its link opens. */
const SIDEBAR_ITEMS = ["/", "/exams", "/settings/profile"];

test.use({ viewport: { width: 1440, height: 900 } });

test("every School sidebar item and every settings tab commits at once, and nothing moves after the click", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);
  const sidebar = page.locator(SIDEBAR);
  await expect(sidebar.locator('a[href="/exams"]')).toBeVisible();

  for (const item of SIDEBAR_ITEMS) {
    await sidebar.locator(`a[href="${item}"]`).click();
    await page.waitForURL((url) => url.pathname === item);
    await page.waitForLoadState("networkidle");
    expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  }

  // The settings page replaces the sidebar's groups with the settings sections.
  await sidebar.locator('a[href="/settings/profile"]').click();
  await page.waitForURL((url) => url.pathname === "/settings/profile");
  const tabs = await sidebar
    .locator('a[href^="/settings/"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? "")
    );
  expect(tabs.length).toBeGreaterThan(1);

  for (const tab of tabs) {
    await sidebar.locator(`a[href="${tab}"]`).click();
    await page.waitForURL((url) => url.pathname === tab);
    await page.waitForLoadState("networkidle");
    expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  }

  await context.close();
});
