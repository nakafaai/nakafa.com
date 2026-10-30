import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The NPSN the owner gives the school's first unit. */
const NPSN = "20104321";

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`the owner keeps the schools in one table, edits one from its row menu, and archives and restores it, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInOwner(context, school.slug, address("/")));
    const page = await context.newPage();
    await page.goto(address("/settings/units"));

    // One card holds the table: each school is one row with its NPSN in words while none is stored, and no card per
    // school or per NPSN stands below it.
    const card = page.locator('[data-slot="table-card"]');
    await expect(card).toHaveCount(1);
    const row = card.getByRole("row").nth(1);
    await expect(row.getByText("Not set", { exact: true })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(row.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(0);

    // Edit stores the NPSN, and the row shows it at once.
    const menu = row.getByRole("button", { name: "More actions" });
    await waitUntilTakenOver(menu);
    await menu.click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "NPSN" }).fill(NPSN);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(row.getByText(NPSN, { exact: true })).toBeVisible();

    // Archive asks first, then the row reads as archived and its menu offers Restore alone.
    await menu.click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Archive", exact: true })
      .click();
    await expect(row.getByText("Archived", { exact: true })).toBeVisible();
    await menu.click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Restore" }).click();
    await expect(row.getByText("Active", { exact: true })).toBeVisible();

    // The server kept the NPSN.
    await page.reload();
    await expect(
      page
        .locator('[data-slot="table-card"]')
        .getByRole("row")
        .nth(1)
        .getByText(NPSN, { exact: true })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await context.close();
  });
}
