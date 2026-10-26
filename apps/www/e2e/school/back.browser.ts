import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * School settings has its own sidebar, so its first row leads back to the school:
 * to the school page the viewer left for settings, past every section opened in
 * between, and Escape leaves the same way. Settings opened first leads to the
 * school's home.
 */
test("the school settings sidebar leads back to the school page the viewer came from, and Escape does too", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/exams"));

  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const settings = sidebar.getByRole("link", { exact: true, name: "Settings" });
  await waitUntilTakenOver(settings);
  await settings.click();
  await expect(page).toHaveURL(address("/settings/profile"));

  const back = sidebar.getByRole("link", {
    exact: true,
    name: `Back to ${school.name}`,
  });
  // The way back is the sidebar's first row, above every settings group.
  await expect(sidebar.getByRole("link").first()).toHaveText(
    `Back to ${school.name}`
  );
  await sidebar.getByRole("button", { name: "People" }).click();
  await sidebar.getByRole("link", { exact: true, name: "Members" }).click();
  await expect(page).toHaveURL(address("/settings/members"));
  await back.click();
  await expect(page).toHaveURL(address("/exams"));

  await settings.click();
  await expect(back).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(address("/exams"));

  // Settings opened first has no school page before it, so its way back leads home.
  await page.goto(address("/settings/profile"));
  await waitUntilTakenOver(back);
  await back.click();
  await expect(page).toHaveURL(address("/"));
  await context.close();
});
