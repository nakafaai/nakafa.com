import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  seedCard,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The status badge of the one row a table holds for this name. */
const statusOf = (page: Page, row: string) =>
  page
    .getByRole("row", { name: row })
    .locator('[data-slot="badge"]')
    .filter({ hasText: "Active" });

test("a period's and a cohort's status show as a badge with the state's own icon", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  // The class teacher's seed opens an active period with the cohort X-1.
  const seed = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/cohorts"));
  const cohort = statusOf(page, "X-1");
  await expect(cohort).toBeVisible();
  await expect(cohort.locator("svg")).toHaveCount(1);

  await page.goto(address("/settings/periods"));
  const period = page
    .locator('[data-slot="table-card"] [data-slot="badge"]')
    .filter({ hasText: "Active" });
  await expect(period).toBeVisible();
  await expect(period.locator("svg")).toHaveCount(1);
  await context.close();
});

test("a guardian link's state shows as a badge with the state's own icon", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  // The card seed writes the student Siswa Uji on the roster.
  await Effect.runPromise(seedCard(school.slug));
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/guardians"));
  const add = page
    .locator("header")
    .getByRole("button", { name: "Link a parent" });
  await waitUntilTakenOver(add);
  await add.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: "Siswa Uji" }).click();
  await dialog.getByLabel("Parent's name").fill("Ibu Uji");
  await dialog
    .getByLabel("Parent email")
    .fill(`ibu.${school.slug}@example.com`);
  await dialog.getByRole("button", { name: "Link a parent" }).click();
  const pending = page
    .getByRole("row")
    .filter({ hasText: "Siswa Uji" })
    .locator('[data-slot="badge"]')
    .filter({ hasText: "Pending" });
  await expect(pending).toBeVisible();
  await expect(pending.locator("svg")).toHaveCount(1);
  await context.close();
});
