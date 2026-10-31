import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, Option, String as Str } from "effect";
import { readSheet } from "read-excel-file/node";
import {
  chooseFile,
  openPeriodWithCohort,
  sheetFile,
} from "@/e2e/support/roster";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

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
  await openPeriodWithCohort(page, address, "7A");

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
  await page
    .locator("header")
    .getByRole("button", { exact: true, name: "Export" })
    .click();
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
