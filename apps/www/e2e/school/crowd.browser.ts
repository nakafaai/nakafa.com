import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, String as Str } from "effect";
import { expectNoOverflow } from "@/e2e/support/layout";
import {
  chooseFile,
  openPeriodWithCohort,
  sheetFile,
} from "@/e2e/support/roster";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The students of one cohort: three of the import's batches of a hundred. */
const CROWD = 300;

/** The class group every imported student joins. */
const COHORT = "7A";

/** A Dapodik list of `CROWD` students in one class group, each with a NISN of ten digits. */
const CROWD_ROWS: (string | number | null)[][] = [
  ["Nama", "NISN", "Tanggal Lahir", "Rombel Saat Ini"],
  ...Arr.makeBy(CROWD, (index) => [
    `Siswa ${index + 1}`,
    Str.padStart(10, "0")(String(index + 1)),
    "2013-05-21",
    COHORT,
  ]),
];

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`an admin imports ${CROWD} students into one cohort, which lists every one, finds the last by name, and never scrolls sideways, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInOwner(context, school.slug, address("/")));
    const page = await context.newPage();
    await openPeriodWithCohort(page, address, COHORT);

    await page.goto(address("/settings/roster"));
    await waitUntilTakenOver(
      page.locator("header").getByRole("button", { name: "Import" })
    );
    await chooseFile(page, await sheetFile("daftar_pd.xlsx", CROWD_ROWS));
    await expect(
      page
        .getByRole("cell", { exact: true, name: `Siswa ${CROWD}` })
        .filter({ visible: true })
        .first()
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await page
      .locator("header")
      .getByRole("button", { name: "Import students" })
      .click();
    await expect(page.getByText("The students are in the roster.")).toBeVisible(
      { timeout: readinessTimeoutMilliseconds }
    );

    await page.goto(address("/settings/cohorts"));
    await page.getByRole("link", { name: COHORT }).click();
    const rows = page.locator('[data-slot="table-card"] tbody tr');
    // The cohort reads its students a page at a time as the table's end comes into view.
    await expect(async () => {
      await rows.last().scrollIntoViewIfNeeded();
      await expect(rows).toHaveCount(CROWD, { timeout: 2000 });
    }).toPass({ timeout: readinessTimeoutMilliseconds * 3 });
    await Effect.runPromise(expectNoOverflow(page, `cohort ${viewport.width}`));

    // The header's search finds the last student among them all.
    const search = page.getByRole("textbox", { name: "Find a student" });
    if (!(await search.isVisible())) {
      await page
        .locator("header")
        .getByRole("button", { name: "Find a student" })
        .click();
    }
    await page
      .getByRole("textbox", { name: "Find a student" })
      .fill(`Siswa ${CROWD}`);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(`Siswa ${CROWD}`);
    await context.close();
  });
}
