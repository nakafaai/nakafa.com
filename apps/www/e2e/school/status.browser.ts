import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";

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
