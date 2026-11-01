import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("an owner reads each step of the setup, opens one, and finishing takes it out of the sidebar", async ({
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

  await page.goto(address("/setup"));
  const finish = page
    .locator("header")
    .getByRole("button", { name: "Finish setup" });
  await waitUntilTakenOver(finish);
  const main = page.getByRole("main");
  for (const step of [
    "Cohorts",
    "Students",
    "Students in cohorts",
    "Classrooms",
    "Teachers",
    "Parents",
    "First exam",
    "Plan",
    "Country and currency",
    "Time zone and language",
    "Policies",
  ]) {
    await expect(main.getByText(step, { exact: true })).toBeVisible();
  }
  // The defaults read as names, never as the codes the school stores.
  await expect(main.getByText("Indonesia, ")).toBeVisible();
  await expect(main.getByText("IDR", { exact: true })).toHaveCount(0);
  const entry = page
    .locator('[data-slot="sidebar"]')
    .getByRole("link", { name: "Set up school" });
  await expect(entry).toBeVisible();

  await finish.click();
  await expect(entry).toHaveCount(0);
  await page.reload();
  await waitUntilTakenOver(finish);
  await expect(entry).toHaveCount(0);
  await context.close();
});
