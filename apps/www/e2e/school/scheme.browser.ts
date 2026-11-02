import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("an admin stores a grading scheme version with a band, then a newer one, and the newest shows in force", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));

  await page.goto(address("/settings/profile"));
  await page.getByRole("link", { exact: true, name: "Grading" }).click();
  await expect(page).toHaveURL(address("/settings/grading"));
  await expect(page.getByText("No version stored yet.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    page.getByText("Grades use the built-in scheme with KKTP 75 and no bands.")
  ).toBeVisible();

  // The first version starts from the built-in scheme, and gains one band.
  const add = page
    .locator("header")
    .getByRole("button", { name: "New version" });
  await waitUntilTakenOver(add);
  await add.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox", { name: "KKTP" })).toHaveValue("75");
  await dialog.getByRole("button", { name: "Add band" }).click();
  await dialog.getByRole("textbox", { name: "Band" }).fill("A");
  await dialog.getByRole("textbox", { name: "From" }).fill("90");
  await dialog.getByRole("button", { name: "Save version" }).click();
  const first = page.getByRole("row").filter({ hasText: "A from 90" });
  await expect(first).toContainText("In force");

  // A newer version opens filled in with the one in force, and takes its place.
  await add.click();
  await expect(dialog.getByRole("textbox", { name: "Band" })).toHaveValue("A");
  await dialog.getByRole("textbox", { name: "KKTP" }).fill("70");
  const storedBefore = changes.sent;
  await dialog.getByRole("button", { name: "Save version" }).click();
  const rows = page.getByRole("row").filter({ hasText: "A from 90" });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("70");
  await expect(rows.first()).toContainText("In force");
  await expect(rows.last()).toContainText("Earlier");
  // A reload drops a change still on its way, so it waits for the server to answer the newer version.
  await saved(changes, storedBefore);
  await page.reload();
  // The row whose status cell reads In force; the head "In force from" names the date column, not a status.
  const inForce = page.getByRole("row").filter({
    has: page.getByRole("cell", { exact: true, name: "In force" }),
  });
  await expect(inForce).toContainText("70", {
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
