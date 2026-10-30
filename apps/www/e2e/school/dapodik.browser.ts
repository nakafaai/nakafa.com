import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Option, String as Str } from "effect";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { chooseDay } from "@/e2e/support/date";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The XLSX type that Dapodik exports. */
const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * A Dapodik student list as it is downloaded: the title rows, the header, the sub-headers
 * under the parents' column group, two students, and one row whose NISN is short.
 */
const DAPODIK: (string | number | null)[][] = [
  ["Daftar Peserta Didik"],
  ["SMP Uji"],
  [],
  [
    "No",
    "Nama",
    "NISN",
    "Tanggal Lahir",
    "NIK",
    "Data Ayah",
    "Rombel Saat Ini",
  ],
  [null, null, null, null, null, "Nama", null],
  [
    1,
    "Raka Pratama",
    "0012345678",
    "2013-05-21",
    "3201000000000001",
    "Agus",
    "7A",
  ],
  [
    2,
    "Sari Dewi",
    "0098765432",
    "2007-01-10",
    "3201000000000002",
    "Budi",
    "7A",
  ],
  [3, "Budi Santoso", "12345", "2013-02-02", "3201000000000003", "Joko", "7A"],
];

/** An XLSX file whose rows the browser reads as the Admin's chosen file. */
const sheetFile = async (name: string, rows: (string | number | null)[][]) => ({
  buffer: await writeXlsxFile(rows).toBuffer(),
  mimeType: XLSX,
  name,
});

/** Opens one period, then adds the cohort 7A to it, as the school's Owner. */
async function openPeriodWithCohort(
  page: Page,
  address: (path: string) => string
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
  await cohortDialog.getByLabel("Name").fill("7A");
  await cohortDialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "7" }).click();
  await cohortDialog.getByRole("button", { name: "Add cohort" }).click();
  await expect(page.getByRole("link", { name: "7A" })).toBeVisible();
}

/** Chooses `file` through the page's Import button, the way the Admin does. */
async function chooseFile(
  page: Page,
  file: Awaited<ReturnType<typeof sheetFile>>
) {
  const chooser = page.waitForEvent("filechooser");
  await page.locator("header").getByRole("button", { name: "Import" }).click();
  await (await chooser).setFiles(file);
}

test("an admin previews a Dapodik file, imports its students into the active period, and exports them back", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({ acceptDownloads: true });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await openPeriodWithCohort(page, address);

  await page.goto(address("/settings/roster"));
  await expect(
    page.getByText("Import the students from Dapodik.")
  ).toBeVisible();
  await waitUntilTakenOver(
    page.locator("header").getByRole("button", { name: "Import" })
  );

  // A sheet without the Nama and NISN columns is refused before any preview.
  await chooseFile(page, await sheetFile("kelas.xlsx", [["Kelas"], ["7A"]]));
  await expect(page.getByText("This file cannot be imported.")).toBeVisible();
  await expect(
    page.getByText("The file has no Nama and NISN columns.")
  ).toBeVisible();

  await chooseFile(page, await sheetFile("daftar_pd.xlsx", DAPODIK));
  const raka = page.getByRole("row").filter({ hasText: "Raka Pratama" });
  await expect(raka).toContainText("0012345678");
  await expect(raka).toContainText("Under 18");
  await expect(
    page.getByRole("row").filter({ hasText: "Sari Dewi" })
  ).toContainText("18 or older");
  await expect(
    page.getByRole("row").filter({ hasText: "NISN is not 10 digits" })
  ).toHaveCount(1);
  // Each status is a badge with the status's own icon, as every School table draws a state.
  for (const status of ["Under 18", "18 or older", "NISN is not 10 digits"]) {
    const badge = page
      .locator('[data-slot="badge"]')
      .filter({ hasText: status });
    await expect(badge.locator("svg")).toHaveCount(1);
  }
  // The preview reads only the name, NISN, birth date and class group: the NIK never shows.
  await expect(page.getByText("3201000000000001")).toHaveCount(0);

  await page
    .locator("header")
    .getByRole("button", { name: "Import students" })
    .click();
  await expect(page.getByText("The students are in the roster.")).toBeVisible();
  await expect(
    page.getByText("Import the students from Dapodik.")
  ).toBeVisible();

  const download = page.waitForEvent("download");
  await page.locator("header").getByRole("button", { name: "Export" }).click();
  const file = await (await download).path();
  const rows = await readSheet(file);
  expect(Arr.head(rows)).toEqual(
    Option.some(["Nama", "NISN", "Rombel Saat Ini"])
  );
  expect(
    Arr.sort(
      Arr.map(Arr.drop(rows, 1), (row) => Arr.join(Arr.map(row, String), "|")),
      Str.Order
    )
  ).toEqual(["Raka Pratama|0012345678|7A", "Sari Dewi|0098765432|7A"]);

  await page.goto(address("/settings/cohorts"));
  await page.getByRole("link", { name: "7A" }).click();
  await expect(page.getByText("Raka Pratama")).toBeVisible();
  await expect(page.getByText("Sari Dewi")).toBeVisible();
  await context.close();
});
