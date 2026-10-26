import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { recordServerFunctionCalls } from "@/e2e/support/requests";
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

test("a click between School pages asks the Worker nothing: each page reads its rows live", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/profile"));
  const sidebar = page.locator(SIDEBAR);
  await expect(sidebar.locator('a[href="/settings/units"]')).toBeVisible();
  await page.waitForLoadState("networkidle");
  const calls = recordServerFunctionCalls(page);

  for (const path of ["/settings/units", "/settings/periods", "/", "/exams"]) {
    const link = sidebar.locator(`a[href="${path}"]`);
    if (path === "/") {
      // Home sits in the school's own sidebar, which the settings replace.
      await page.locator('[data-slot="page-header"] a[href="/"]').click();
    } else if (path === "/exams") {
      await sidebar.locator('a[href="/exams"]').click();
    } else {
      await link.click();
    }
    await page.waitForURL((url) => url.pathname === path);
  }
  await page.waitForLoadState("networkidle");

  expect(MutableList.toArray(calls)).toEqual([]);
  await context.close();
});
