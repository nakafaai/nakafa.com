import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { type Changes, saved, trackChanges } from "@/e2e/support/changes";
import { chooseDay } from "@/e2e/support/date";
import { assignHomeroom } from "@/e2e/support/homeroom";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The cohort that the class teacher's seed opens in the school's active period. */
const SEEDED_COHORT = "X-1";

/** The teacher the class teacher's sign-in seeds, whom the Owner makes the cohort's homeroom teacher. */
const CLASS_TEACHER = "Acceptance Class Teacher";

/** The address of one cohort's page. */
const COHORT_PAGE = /\/settings\/cohorts\/[^/]+$/u;

/** Adds one cohort of grade 10, the first grade of the acceptance school's SMA unit, from the cohorts page. */
async function addCohort(page: Page, name: string) {
  const add = page
    .locator("header")
    .getByRole("button", { name: "Add cohort" });
  await waitUntilTakenOver(add);
  await add.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "10" }).click();
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

test("a cohort's page is its students' list alone, and its header holds only search and placement", async ({
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

  // The owner's rule (13 Nov): a table is the page's whole body, so no card stands above it.
  await expect(page.locator('[data-slot="table-card"]')).toBeVisible();
  await expect(page.locator('main [data-slot="card"]')).toHaveCount(0);
  await expect(
    page.locator("header").getByRole("button", { name: "Homeroom teacher" })
  ).toHaveCount(0);
  await context.close();
});

test("the cohort's row menu saves a homeroom teacher and removes them, each change shown at once", async ({
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

  await assignHomeroom(page, SEEDED_COHORT, CLASS_TEACHER);

  // A second page reads the cohorts from the server, which holds the teacher.
  const second = await context.newPage();
  await second.goto(address("/settings/cohorts"));
  const secondRow = second.getByRole("row").filter({
    has: second.getByRole("link", { exact: true, name: SEEDED_COHORT }),
  });
  await expect(secondRow.getByText(CLASS_TEACHER)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await second.close();

  // The dialog of a cohort with a teacher shows the teacher, and its one action removes them.
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { exact: true, name: SEEDED_COHORT }),
  });
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Homeroom teacher" }).click();
  const dialog = page.getByRole("dialog", { name: "Homeroom teacher" });
  await expect(dialog.getByText(CLASS_TEACHER)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save" })).toHaveCount(0);
  await dialog.getByRole("button", { exact: true, name: "Remove" }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByText(CLASS_TEACHER)).toHaveCount(0, {
    timeout: readinessTimeoutMilliseconds,
  });
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

test("an admin opens a period, then creates a cohort of it in a grade its SMA unit teaches and edits its name and grade", async ({
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
  await cohortDialog.getByLabel("Name").fill("X A");
  // The acceptance school's unit is an SMA, so the grade list holds its grades and no other.
  await cohortDialog.getByRole("combobox", { name: "Grade" }).click();
  await expect(page.getByRole("option")).toHaveText(["10", "11", "12"]);
  await page.getByRole("option", { exact: true, name: "10" }).click();
  await cohortDialog.getByRole("button", { name: "Add cohort" }).click();
  const cohortRow = page.getByRole("row", { name: "X A" });
  await expect(cohortRow).toBeVisible();

  // Edit starts from the cohort's name and grade, and the row shows both changes at once.
  await cohortRow.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog.getByLabel("Name")).toHaveValue("X A");
  await expect(editDialog.getByRole("combobox", { name: "Grade" })).toHaveText(
    "10"
  );
  await editDialog.getByLabel("Name").fill("XI Biru");
  await editDialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "11" }).click();
  const editedBefore = changes.sent;
  await editDialog.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row", { name: "XI Biru" });
  await expect(editedRow).toBeVisible();
  await expect(
    editedRow.getByRole("cell", { exact: true, name: "11" })
  ).toBeVisible();

  // The server kept both.
  await saved(changes, editedBefore);
  await page.reload();
  await expect(
    page
      .getByRole("row", { name: "XI Biru" })
      .getByRole("cell", { exact: true, name: "11" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await context.close();
});

test("an admin places a student in a cohort, moves the student to another, sets their NISN and age flag, and moves them out once that cohort is archived", async ({
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
  await kept.getByRole("button", { name: "Cancel" }).click();

  // An archived cohort takes no one new, and its student still moves out of it.
  await page.goto(address("/settings/cohorts"));
  const archivedRow = page.getByRole("row", { name: "7B" });
  await archivedRow.getByRole("button", { name: "More actions" }).click();
  const archivedBefore = changes.sent;
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(archivedRow.getByText("Archived")).toBeVisible();
  await saved(changes, archivedBefore);
  await page.getByRole("link", { name: "7B" }).click();
  // The list stays until the cohort's page is ready, so the menu is the one in the student's own row.
  await page.waitForURL(COHORT_PAGE);
  const leaving = page
    .getByRole("row")
    .filter({ hasText: "Acceptance Learner" })
    .getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(leaving);
  await leaving.click();
  await page.getByRole("menuitem", { name: "Move" }).click();
  const outDialog = page.getByRole("dialog");
  await outDialog.getByRole("combobox", { name: "Move to" }).click();
  await page.getByRole("option", { exact: true, name: "7A" }).click();
  const leftBefore = changes.sent;
  await outDialog.getByRole("button", { exact: true, name: "Move" }).click();
  await expect(page.getByText("No student yet.")).toBeVisible();
  await saved(changes, leftBefore);
  await page.goto(address("/settings/cohorts"));
  await page.getByRole("link", { name: "7A" }).click();
  await expect(
    page.getByRole("main").getByText("Acceptance Learner", { exact: true })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await context.close();
});

test("a student added with a card joins a cohort and takes a parent at once, and an empty picker says in one sentence that no student is available", async ({
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
  await page.goto(address("/settings/periods"));
  await openSemester(page, changes);
  await page.goto(address("/settings/cohorts"));
  await addCohort(page, "7A");

  await page.getByRole("link", { name: "7A" }).click();
  const cohort = page.url();
  const place = page
    .locator("header")
    .getByRole("button", { name: "Add student" });
  await waitUntilTakenOver(place);
  await place.click();
  const placing = page.getByRole("dialog");
  await placing.getByRole("combobox", { name: "Student" }).click();
  await expect(page.getByText("No student is available.")).toBeVisible();
  await page.goto(address("/settings/students"));

  const add = page
    .locator("header")
    .getByRole("button", { name: "Add student" });
  await waitUntilTakenOver(add);
  await add.click();
  const enrolling = page.getByRole("dialog");
  await enrolling
    .getByRole("textbox", { exact: true, name: "Name" })
    .fill("Ayu Lestari");
  await enrolling.getByLabel("Login name").fill("ayu.lestari");
  await enrolling.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByRole("dialog", { name: "Login card" })).toBeVisible();

  await page.goto(cohort);
  await waitUntilTakenOver(place);
  await place.click();
  await placing.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: "Ayu Lestari" }).click();
  await placing.getByRole("button", { name: "Add student" }).click();
  await expect(
    page.getByRole("main").getByText("Ayu Lestari", { exact: true })
  ).toBeVisible();

  await page.goto(address("/settings/guardians"));
  const link = page
    .locator("header")
    .getByRole("button", { name: "Link a parent" });
  await waitUntilTakenOver(link);
  await link.click();
  await page.getByRole("dialog").getByRole("combobox").first().click();
  await expect(page.getByRole("option", { name: "Ayu Lestari" })).toBeVisible();
  await context.close();
});

test("a cohort held by an archived class counts it and offers no delete, and a cohort holding nothing asks with what it removes", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  // The class teacher's seed opens the period with the cohort X-1 and its class Fisika X-1.
  const seed = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/classes"));
  const classRow = page.getByRole("row").filter({ hasText: "Fisika X-1" });
  const classMenu = classRow.getByRole("button", { name: "More actions" });
  await expect(classMenu).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await waitUntilTakenOver(classMenu);
  await classMenu.click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(classRow.getByText("Archived")).toBeVisible();

  await page.goto(address("/settings/cohorts"));
  const held = page.getByRole("row").filter({ hasText: SEEDED_COHORT });
  await expect(held.getByRole("cell", { exact: true, name: "1" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const heldMenu = held.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(heldMenu);
  await heldMenu.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Archive" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await addCohort(page, "7Z");
  const free = page.getByRole("row").filter({ hasText: "7Z" });
  await free.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  // The confirm's body shows the cohort it removes, and the header holds its close.
  await expect(dialog.getByText("7Z", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete cohort" }).click();
  await expect(free).toHaveCount(0);
  await context.close();
});
