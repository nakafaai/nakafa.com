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
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/setup"));
  const finish = page
    .locator("header")
    .getByRole("button", { name: "Finish setup" });
  await waitUntilTakenOver(finish);
  for (const step of [
    "Plan and contract",
    "Country profile",
    "Period and class groups",
    "Import students",
    "School policies",
    "Try one exam",
  ]) {
    await expect(page.getByRole("heading", { name: step })).toBeVisible();
  }
  const entry = page.getByRole("link", { name: "Set up school" });
  await expect(entry).toBeVisible();

  await finish.click();
  await expect(entry).toHaveCount(0);
  await page.reload();
  await waitUntilTakenOver(finish);
  await expect(entry).toHaveCount(0);
  await context.close();
});
