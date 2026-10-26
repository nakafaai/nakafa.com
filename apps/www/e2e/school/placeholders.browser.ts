import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The design system's text fields in a part of the page that show no hint of what to write. */
const unhinted = (part: Locator) =>
  part.locator(
    '[data-slot="input"]:not([placeholder]), [data-slot="textarea"]:not([placeholder])'
  );

test("every School text field shows what to write: the card sign-in, the invite and the profile", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);

  const visitor = await browser.newContext();
  const entry = await visitor.newPage();
  await entry.goto(address("/?masuk=username"));
  await waitUntilTakenOver(entry.getByRole("button", { name: "Sign in" }));
  await expect(entry.locator('form [data-slot="input"]')).not.toHaveCount(0);
  await expect(unhinted(entry.locator("form"))).toHaveCount(0);
  await visitor.close();

  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/members"));
  const invite = page.locator("header").getByRole("button", { name: "Invite" });
  await waitUntilTakenOver(invite);
  await invite.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[data-slot="input"]')).not.toHaveCount(0);
  await expect(unhinted(dialog)).toHaveCount(0);

  await page.goto(address("/settings/profile"));
  await expect(page.locator('main [data-slot="input"]').first()).toBeVisible();
  await expect(unhinted(page.locator("main"))).toHaveCount(0);
  await context.close();
});
