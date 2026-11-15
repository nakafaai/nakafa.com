import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { chooseDay } from "@/e2e/support/date";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The last quarter hour of a day, as the time list names it in a 12 or a 24 hour locale. */
const LATE_EVENING = /^(?:11:45\sPM|23:45)$/u;

/** The address of the task the test publishes, which opens the class's tasks with it in the pane. */
const TASK_PATH = "/classes/fisika-x-1/tasks/ulangan-harian";

/** The address of a sitting page, which the task's Start opens. */
const SITTING_PATH = /\/sittings\/[^/#]+/u;

/** The address of a sitting's results, which the task's pane opens for its teacher. */
const RESULTS_PATH = /\/exams\/[^/]+\/sittings\/[^/]+\/results$/u;

/** The keyed exam that the sitting seed writes in the school's first unit, the class's unit. */
const EXAM_TITLE = "Ujian Acceptance";

/** Places the learner in the cohort X-1 of the active period as the school's Owner, so the class's tasks reach them. */
async function placeLearner(page: Page, address: (path: string) => string) {
  await page.goto(address("/settings/cohorts"));
  const cohort = page.getByRole("link", { exact: true, name: "X-1" });
  await waitUntilTakenOver(cohort);
  await cohort.click();
  await page
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: "Acceptance Learner" }).click();
  await dialog.getByRole("button", { name: "Add student" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Acceptance Learner" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
}

/** Presses one item of the menu of the task's row. */
async function rowAction(page: Page, item: string) {
  await page
    .getByRole("row")
    .filter({ hasText: "Ulangan Harian" })
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { exact: true, name: item }).click();
}

test("a teacher publishes a task from an exam, a student does it in the exam player, the teacher reads its results, and the task is archived, restored and deleted", async ({
  baseURL,
  browser,
}, info) => {
  test.setTimeout(readinessTimeoutMilliseconds * 24);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learnerAddress = `homework-${school.slug}@acceptance.example.test`;
  const viewport = { height: 900, width: 1440 };
  const learner = await browser.newContext({ viewport });
  await Effect.runPromise(
    inviteLearner({
      address: learnerAddress,
      baseURL: address("/"),
      context: learner,
      slug: school.slug,
    })
  );
  const teacher = await browser.newContext({ viewport });
  await Effect.runPromise(
    signInClassTeacher(teacher, school.slug, address("/"))
  );
  const owner = await browser.newContext({ viewport });
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  // The seed writes a keyed exam in the class's unit and gives the learner a student grant there.
  await Effect.runPromise(seedSitting(school.slug, learnerAddress));
  await placeLearner(await owner.newPage(), address);
  await owner.close();

  // The teacher picks the exam as the task's questions and publishes it.
  const tasks = await teacher.newPage();
  await tasks.goto(address("/classes/fisika-x-1/tasks"));
  await expect(tasks.getByText("No task yet")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const create = tasks.getByRole("button", { name: "New task" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = tasks.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Title" }).fill("Ulangan Harian");
  await dialog
    .getByRole("textbox", { name: "What to do" })
    .fill("Kerjakan di pemutar ujian.");
  await chooseDay(tasks, dialog.getByLabel("Deadline"), "2027-10-30");
  await dialog.getByRole("combobox", { name: "Time" }).click();
  await tasks.getByRole("option", { name: LATE_EVENING }).click();
  await dialog.getByRole("combobox", { name: "Questions" }).click();
  await tasks.getByRole("option", { name: EXAM_TITLE }).click();
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(dialog).toBeHidden({ timeout: readinessTimeoutMilliseconds });
  await expect(
    tasks.getByRole("button", { name: "Ulangan Harian" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // The student's Start opens the one exam player on the task's run, entered with its token.
  const page = await learner.newPage();
  await page.goto(address(TASK_PATH));
  const pane = page.getByRole("complementary", { name: "Task" });
  const start = pane.getByRole("link", { name: "Start" });
  await expect(start).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await page.screenshot({ path: info.outputPath("homework-student-pane.png") });
  await start.click();
  await page.waitForURL(SITTING_PATH);
  await page
    .getByRole("radiogroup")
    .first()
    .getByRole("radio")
    .first()
    .click({ timeout: readinessTimeoutMilliseconds });
  await page.getByRole("button", { exact: true, name: "Finish" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Finish" })
    .click();
  await expect(page.getByText("You finished this exam.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await page.screenshot({ path: info.outputPath("homework-finished.png") });
  await learner.close();

  // The teacher opens the run's results from the task's pane.
  await tasks.goto(address(TASK_PATH));
  const teacherPane = tasks.getByRole("complementary", { name: "Task" });
  await expect(
    teacherPane.getByRole("link", { name: "Questions" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await tasks.screenshot({
    path: info.outputPath("homework-teacher-pane.png"),
  });
  await teacherPane.getByRole("link", { name: "Results" }).click();
  await tasks.waitForURL(RESULTS_PATH);
  await expect(tasks.getByText("Acceptance Learner").first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await tasks.screenshot({ path: info.outputPath("homework-results.png") });

  // Archive takes the task off the class's list, the Archived view shows it, Restore brings it back, and Delete ends it.
  await tasks.goto(address("/classes/fisika-x-1/tasks"));
  await expect(
    tasks.getByRole("button", { name: "Ulangan Harian" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await rowAction(tasks, "Archive");
  await expect(tasks.getByText("No task yet")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  // The list's views stand in the body above its card, never in the header.
  const views = tasks.getByRole("group", { name: "Show tasks" });
  await views.getByRole("button", { name: "Archived" }).click();
  await expect(
    tasks.getByRole("button", { name: "Ulangan Harian" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await rowAction(tasks, "Restore");
  await expect(tasks.getByText("No archived task")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await views.getByRole("button", { name: "Active" }).click();
  // The menu reads label, main actions, a separator, then Archive and Delete last.
  await tasks
    .getByRole("row")
    .filter({ hasText: "Ulangan Harian" })
    .getByRole("button", { name: "More actions" })
    .click();
  const menu = tasks.getByRole("menu");
  await expect(menu.getByRole("separator")).toHaveCount(1);
  await expect(menu.getByRole("menuitem").last()).toHaveText("Delete task");
  await tasks.screenshot({ path: info.outputPath("homework-menu.png") });
  await menu
    .getByRole("menuitem", { exact: true, name: "Delete task" })
    .click();
  // The confirmation's body shows the task it deletes, and its footer holds the action alone: the close is the way out.
  const confirm = tasks.getByRole("dialog", { name: "Delete this task" });
  await expect(confirm.getByText("Ulangan Harian")).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await tasks.screenshot({ path: info.outputPath("homework-delete.png") });
  await confirm.getByRole("button", { name: "Delete task" }).click();
  await expect(tasks.getByText("No task yet")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await teacher.close();
});
