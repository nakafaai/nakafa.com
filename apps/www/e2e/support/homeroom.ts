import { expect, type Page } from "@playwright/test";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * Makes a teacher a cohort's homeroom teacher as an admin does: from the school's cohorts, the cohort's row menu opens
 * its homeroom dialog, the teacher is chosen and saved, and the cohorts table shows the teacher in the cohort's row once
 * the server holds it. The page must stand on the school's cohorts settings.
 */
export async function assignHomeroom(
  page: Page,
  cohort: string,
  teacher: string
) {
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { exact: true, name: cohort }),
  });
  const menu = row.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(menu);
  await menu.click();
  await page.getByRole("menuitem", { name: "Homeroom teacher" }).click();
  const dialog = page.getByRole("dialog", { name: "Homeroom teacher" });
  await dialog.getByRole("combobox", { name: "Teacher" }).click();
  await page.getByRole("option", { name: teacher }).click();
  await dialog.getByRole("button", { exact: true, name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByText(teacher)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
}
