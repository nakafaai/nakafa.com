import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { type Changes, saved, trackChanges } from "@/e2e/support/changes";
import { chooseDay } from "@/e2e/support/date";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { shownLabels, watchLabels } from "@/e2e/support/shown";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The cohort that the class teacher's seed opens in the school's active period. */
const SEEDED_COHORT = "X-1";

/** The address of one cohort's page. */
const COHORT_PAGE = /\/settings\/cohorts\/[^/]+$/u;

/** Adds one cohort of grade 7 to the active period, from the cohorts page. */
async function addCohort(page: Page, name: string) {
  const add = page
    .locator("header")
    .getByRole("button", { name: "Add cohort" });
  await waitUntilTakenOver(add);
  await add.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "7" }).click();
  await dialog.getByRole("button", { name: "Add cohort" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
}

/**
 * Adds the period `Semester 1` from the periods page and opens it, then waits until the server answered the open. A
 * navigation right after Open closes the connection and drops the open while it is on its way, and a unit with no
 * active period keeps Add cohort disabled.
 */
async function openSemester(page: Page, changes: Changes) {
  const addPeriod = page
    .locator("header")
    .getByRole("button", { name: "Add period" });
  await waitUntilTakenOver(addPeriod);
  await addPeriod.click();
  const periodDialog = page.getByRole("dialog");
  await periodDialog.getByLabel("Name").fill("Semester 1");
  await expect(periodDialog.locator('input[type="date"]')).toHaveCount(0);
  await chooseDay(page, periodDialog.getByLabel("First day"), "2027-07-01");
  await chooseDay(page, periodDialog.getByLabel("Last day"), "2027-12-20");
  await periodDialog.getByRole("button", { name: "Add period" }).click();
  const periodRow = page.getByRole("row", { name: "Semester 1" });
  await periodRow.getByRole("button", { name: "More actions" }).click();
  const openedBefore = changes.sent;
  await page.getByRole("menuitem", { name: "Open" }).click();
  await expect(periodRow.getByText("Active")).toBeVisible();
  await saved(changes, openedBefore);
}

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

test("an admin opens a period, then creates a cohort of it and edits its name and grade", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));

  // A cohort belongs to the active period, so the admin opens a period first.
  await page.goto(address("/settings/periods"));
  await openSemester(page, changes);

  await page.goto(address("/settings/cohorts"));
  await expect(page).toHaveURL(address("/settings/cohorts"));
  const addCohortAction = page
    .locator("header")
    .getByRole("button", { name: "Add cohort" });
  await waitUntilTakenOver(addCohortAction);
  await addCohortAction.click();
  const cohortDialog = page.getByRole("dialog");
  await cohortDialog.getByLabel("Name").fill("7A");
  await cohortDialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "7" }).click();
  await cohortDialog.getByRole("button", { name: "Add cohort" }).click();
  const cohortRow = page.getByRole("row", { name: "7A" });
  await expect(cohortRow).toBeVisible();

  // Edit starts from the cohort's name and grade, and the row shows both changes at once.
  await cohortRow.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog.getByLabel("Name")).toHaveValue("7A");
  await expect(editDialog.getByRole("combobox", { name: "Grade" })).toHaveText(
    "7"
  );
  await editDialog.getByLabel("Name").fill("8 Biru");
  await editDialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "8" }).click();
  const editedBefore = changes.sent;
  await editDialog.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row", { name: "8 Biru" });
  await expect(editedRow).toBeVisible();
  await expect(
    editedRow.getByRole("cell", { exact: true, name: "8" })
  ).toBeVisible();

  // The server kept both.
  await saved(changes, editedBefore);
  await page.reload();
  await expect(
    page
      .getByRole("row", { name: "8 Biru" })
      .getByRole("cell", { exact: true, name: "8" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await context.close();
});

test("an admin places a student in a cohort, moves the student to another, and sets their NISN and age flag", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learnerAddress = `student-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learnerAddress,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await learnerContext.close();
  await Effect.runPromise(grantStudent(school.slug, learnerAddress));
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));

  await page.goto(address("/settings/periods"));
  await openSemester(page, changes);

  await page.goto(address("/settings/cohorts"));
  await addCohort(page, "7A");
  await addCohort(page, "7B");

  // The admin places the learner in 7A, then moves them to 7B, which shows at once.
  await page.getByRole("link", { name: "7A" }).click();
  await page
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const placeDialog = page.getByRole("dialog");
  await placeDialog.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: "Acceptance Learner" }).click();
  await placeDialog.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(
    1
  );

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move" }).click();
  const moveDialog = page.getByRole("dialog");
  await moveDialog.getByRole("combobox", { name: "Move to" }).click();
  await page.getByRole("option", { exact: true, name: "7B" }).click();
  const movedBefore = changes.sent;
  await moveDialog.getByRole("button", { exact: true, name: "Move" }).click();
  await expect(page.getByText("No student yet.")).toBeVisible();

  await saved(changes, movedBefore);
  await page.goto(address("/settings/cohorts"));
  await page.getByRole("link", { name: "7B" }).click();
  await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(
    1
  );

  // The admin sets the student's NISN by hand; the roster keeps it, and the dialog never shows it back.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "NISN" }).click();
  const entryDialog = page.getByRole("dialog");
  const nisnField = entryDialog.getByRole("textbox", { name: "NISN" });
  await expect(nisnField).toBeEnabled();
  await expect(nisnField).toHaveAttribute("placeholder", "10 digits");
  await nisnField.fill("0012345678");
  const enteredBefore = changes.sent;
  await entryDialog.getByRole("button", { name: "Save" }).click();
  await expect(entryDialog).toBeHidden();
  await saved(changes, enteredBefore);
  await page.reload();
  const reopened = page.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(reopened);
  await reopened.click();
  await page.getByRole("menuitem", { name: "NISN" }).click();
  const kept = page.getByRole("dialog");
  await expect(kept.getByRole("textbox", { name: "NISN" })).toHaveAttribute(
    "placeholder",
    "Stored, type a new one to replace it"
  );
  await expect(kept.getByRole("textbox", { name: "NISN" })).toHaveValue("");
  await context.close();
});
