import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

test("a school without a logo shows its animal beside its name, and its account menu lists its items", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);

  const header = page.locator('[data-slot="sidebar-header"]');
  await expect(header.getByText(school.name, { exact: true })).toBeVisible();
  await expect(header.locator('[data-slot="avatar-fallback"]')).toBeVisible();
  await expect(header.locator("img")).toHaveCount(0);

  await page.getByRole("button", { name: "Acceptance Owner" }).click();

  for (const item of [
    "Account settings",
    "Theme",
    "Language",
    "Back to Nakafa",
    "Logout",
  ]) {
    await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
  }
  await context.close();
});
