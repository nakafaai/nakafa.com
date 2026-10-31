import { expect, type Page } from "@playwright/test";
import writeXlsxFile from "write-excel-file/node";
import { chooseDay } from "@/e2e/support/date";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The XLSX type that Dapodik exports. */
const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** An XLSX file whose rows the browser reads as the Admin's chosen file. */
export const sheetFile = async (
  name: string,
  rows: (string | number | null)[][]
) => ({
  buffer: await writeXlsxFile(rows).toBuffer(),
  mimeType: XLSX,
  name,
});

/** Opens one period, then adds one cohort of grade 7 to it, as the school's Owner. */
export async function openPeriodWithCohort(
  page: Page,
  address: (path: string) => string,
  cohort: string
) {
  await page.goto(address("/settings/periods"));
  const addPeriod = page
    .locator("header")
    .getByRole("button", { name: "Add period" });
  await waitUntilTakenOver(addPeriod);
  await addPeriod.click();
  const periodDialog = page.getByRole("dialog");
  await periodDialog.getByLabel("Name").fill("Semester 1");
  await chooseDay(page, periodDialog.getByLabel("First day"), "2027-07-01");
  await chooseDay(page, periodDialog.getByLabel("Last day"), "2027-12-20");
  await periodDialog.getByRole("button", { name: "Add period" }).click();
  const periodRow = page.getByRole("row", { name: "Semester 1" });
  await periodRow.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Open" }).click();
  await expect(periodRow.getByText("Active")).toBeVisible();

  await page.goto(address("/settings/cohorts"));
  const addCohort = page
    .locator("header")
    .getByRole("button", { name: "Add cohort" });
  await waitUntilTakenOver(addCohort);
  await addCohort.click();
  const cohortDialog = page.getByRole("dialog");
  await cohortDialog.getByLabel("Name").fill(cohort);
  await cohortDialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "7" }).click();
  await cohortDialog.getByRole("button", { name: "Add cohort" }).click();
  await expect(page.getByRole("link", { name: cohort })).toBeVisible();
}

/** Chooses `file` through the page's Import button, the way the Admin does. */
export async function chooseFile(
  page: Page,
  file: Awaited<ReturnType<typeof sheetFile>>
) {
  const chooser = page.waitForEvent("filechooser");
  await page.locator("header").getByRole("button", { name: "Import" }).click();
  await (await chooser).setFiles(file);
}
