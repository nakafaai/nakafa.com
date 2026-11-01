import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("a member switches a notice's email off, and it stays off after a reload", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/notifications"));
  const preferences = page
    .locator("header")
    .getByRole("button", { name: "Preferences" });
  await waitUntilTakenOver(preferences);
  await preferences.click();
  const mail = page
    .getByRole("dialog")
    .getByRole("switch", { name: "Mentions in a class, Email" });
  await expect(mail).toBeChecked();
  await mail.click();
  await expect(mail).not.toBeChecked();

  await page.reload();
  await waitUntilTakenOver(preferences);
  await preferences.click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("switch", { name: "Mentions in a class, Email" })
  ).not.toBeChecked();
  await context.close();
});
