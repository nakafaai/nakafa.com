import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { shownLabels, watchLabels } from "@/e2e/support/shown";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The cohort that the class teacher's seed opens in the school's active period. */
const SEEDED_COHORT = "X-1";

/** The address of one cohort's page. */
const COHORT_PAGE = /\/settings\/cohorts\/[^/]+$/;

test("a cohort's page shows its homeroom teacher as a card above its students, and its header holds only search and placement", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const seed = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/cohorts"));

  const cohort = page.getByRole("link", { exact: true, name: SEEDED_COHORT });
  await waitUntilTakenOver(cohort);
  await cohort.click();
  await expect(page).toHaveURL(COHORT_PAGE);

  const card = page.locator('[data-slot="card"]').filter({
    hasText: "Homeroom teacher",
  });
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Choose the teacher who leads this cohort.")
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("button", { name: "Homeroom teacher" })
  ).toHaveCount(0);
  // The card stands above the students' table, in the same column.
  const table = page.locator('[data-slot="table-card"]');
  const [cardBox, tableBox] = await Promise.all([
    card.boundingBox(),
    table.boundingBox(),
  ]);
  expect((cardBox?.y ?? 0) + (cardBox?.height ?? 0)).toBeLessThanOrEqual(
    tableBox?.y ?? 0
  );
  expect(cardBox?.width).toBe(tableBox?.width);
  await context.close();
});

test("the homeroom card's Remove and Save keep their words while a teacher is saved and removed", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const seed = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/cohorts"));
  const cohort = page.getByRole("link", { exact: true, name: SEEDED_COHORT });
  await waitUntilTakenOver(cohort);
  await cohort.click();
  await expect(page).toHaveURL(COHORT_PAGE);
  const cohortAddress = page.url();

  const card = page.locator('[data-slot="card"]').filter({
    hasText: "Homeroom teacher",
  });
  const footer = card.locator('[data-slot="card-footer"]');
  const remove = footer.getByRole("button", { exact: true, name: "Remove" });
  const save = footer.getByRole("button", { exact: true, name: "Save" });
  const picker = card.getByRole("combobox", { name: "Teacher" });
  await waitUntilTakenOver(picker);
  await expect(remove).toBeDisabled();
  await expect(save).toBeDisabled();
  await watchLabels(footer);

  await picker.click();
  await page.getByRole("option", { name: "Acceptance Class Teacher" }).click();
  await expect(save).toBeEnabled();
  await save.click();
  // The teacher shows at once in the picker's place, and the button the click landed on stays Save, now disabled.
  await expect(picker).toHaveCount(0);
  await expect(card.getByText("Acceptance Class Teacher")).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(remove).toBeEnabled();

  // A second page reads the cohort from the server, which holds the teacher.
  const second = await context.newPage();
  await second.goto(cohortAddress);
  const secondCard = second.locator('[data-slot="card"]').filter({
    hasText: "Homeroom teacher",
  });
  await expect(secondCard.getByText("Acceptance Class Teacher")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await second.close();

  await remove.click();
  await expect(picker).toBeVisible();
  await expect(remove).toBeDisabled();
  await expect(save).toBeDisabled();
  const third = await context.newPage();
  await third.goto(cohortAddress);
  await expect(third.getByRole("combobox", { name: "Teacher" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await third.close();

  expect(await shownLabels(page)).toEqual([["Remove", "Save"]]);
  await context.close();
});

test("the audit trail says, under its list, that policy values are not copied into it", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/audit"));

  await expect(
    page
      .locator('[data-slot="table-card"]')
      .getByText("Policy values are not copied into the trail.")
  ).toBeVisible();
  await context.close();
});
