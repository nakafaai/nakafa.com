import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
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

/** The last quarter hour of a day, as the time list names it in a 12 or a 24 hour locale. */
const LATE_EVENING = /^(?:11:45\sPM|23:45)$/u;

/** The narrowest screen whose task pane stands beside the list rather than in a sheet. */
const WIDE = 1280;

/** The open task: the pane at the screen's right on a wide screen, the sheet from the bottom on a narrow one. */
const paneOf = (page: Page, width: number) =>
  width >= WIDE
    ? page.getByRole("complementary", { name: "Task" })
    : page.getByRole("dialog", { name: "Latihan Gerak Lurus" });

/** The address of the class's tasks, which a press on a task keeps. */
const TASKS_PATH = /\/classes\/fisika-x-1\/tasks$/u;

/** The address of the task the test publishes. */
const TASK_PATH = /\/classes\/fisika-x-1\/tasks\/latihan-gerak-lurus$/u;

/**
 * Publishes the task `Latihan Gerak Lurus`, due late on 30 October 2027, from the tasks of the class that
 * `signInClassTeacher` seeds, on a page that shows them with no task yet.
 */
async function publishTask(page: Page) {
  const create = page.getByRole("button", { name: "New task" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Title" })
    .fill("Latihan Gerak Lurus");
  await dialog
    .getByRole("textbox", { name: "What to do" })
    .fill("Kerjakan soal 1 sampai 10.");
  // The deadline is a day from the calendar and a time from the list, with no native picker.
  await chooseDay(page, dialog.getByLabel("Deadline"), "2027-10-30");
  await dialog.getByRole("combobox", { name: "Time" }).click();
  await page.getByRole("option", { name: LATE_EVENING }).click();
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(dialog).toBeHidden();
}

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a subject teacher publishes a task, opens it in the pane beside the list, edits it from the pane, and deletes it, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const page = await context.newPage();
    const changes = await Effect.runPromise(trackChanges(page, []));
    await page.goto(address("/classes/fisika-x-1/tasks"));
    await expect(page.getByText("No task yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    await publishTask(page);

    const open = page.getByRole("button", { name: "Latihan Gerak Lurus" });
    await expect(open).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(page.getByText("0 handed in")).toBeVisible();
    await open.click();
    // A wide screen keeps the task in the pane at the screen's right, and a phone in a sheet from the bottom.
    const pane = paneOf(page, viewport.width);
    await expect(pane.getByText("Kerjakan soal 1 sampai 10.")).toBeVisible();
    await expect(pane.getByText("No work yet")).toBeVisible();
    await expect(page).toHaveURL(TASKS_PATH);
    await page.screenshot({
      path: test.info().outputPath(`task-pane-${viewport.width}.png`),
    });

    // Edit task in the pane's footer opens the task as it stands, saves only a change, and keeps the task's address.
    await pane.getByRole("button", { name: "Edit task" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit task" });
    await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Latihan Gerak Lurus"
    );
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
    await dialog
      .getByRole("textbox", { name: "What to do" })
      .fill("Kerjakan soal 1 sampai 5.");
    const editedBefore = changes.sent;
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(pane.getByText("Kerjakan soal 1 sampai 5.")).toBeVisible();
    // The server keeps the edit once it answered, and the task's own address opens the list with it in the pane.
    await saved(changes, editedBefore);
    await page.goto(address("/classes/fisika-x-1/tasks/latihan-gerak-lurus"));
    await page.waitForURL(TASK_PATH);
    await expect(
      paneOf(page, viewport.width).getByText("Kerjakan soal 1 sampai 5.")
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toContainText("Latihan Gerak Lurus");
    if (viewport.width < WIDE) {
      await page.keyboard.press("Escape");
      await expect(paneOf(page, viewport.width)).toBeHidden();
    }

    // Delete asks first, takes the row away at once, and the class is left with no task.
    await page
      .getByRole("row")
      .filter({ hasText: "Latihan Gerak Lurus" })
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Delete task" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this task" });
    await confirm.getByRole("button", { name: "Delete task" }).click();
    await expect(page.getByText("No task yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await context.close();
  });
}

test("a student's work stays in the field after a hand-in, and Hand in keeps its words through a second one", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learnerAddress = `student-${school.slug}@acceptance.example.test`;
  const learner = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    inviteLearner({
      address: learnerAddress,
      baseURL: address("/"),
      context: learner,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learnerAddress));
  const teacher = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(teacher, school.slug, address("/"))
  );

  // The school's Owner places the learner in the class's cohort, X-1 of the active period.
  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  const settings = await owner.newPage();
  await settings.goto(address("/settings/cohorts"));
  const cohortLink = settings.getByRole("link", { exact: true, name: "X-1" });
  await waitUntilTakenOver(cohortLink);
  await cohortLink.click();
  await settings
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const placeDialog = settings.getByRole("dialog");
  await placeDialog.getByRole("combobox", { name: "Student" }).click();
  await settings.getByRole("option", { name: "Acceptance Learner" }).click();
  await placeDialog.getByRole("button", { name: "Add student" }).click();
  await expect(
    settings.getByRole("row").filter({ hasText: "Acceptance Learner" })
  ).toBeVisible();
  await owner.close();

  const tasks = await teacher.newPage();
  await tasks.goto(address("/classes/fisika-x-1/tasks"));
  await expect(tasks.getByText("No task yet")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await publishTask(tasks);

  // A task for part of the class waits for a student, and goes to the one the teacher ticks.
  await tasks.getByRole("button", { name: "New task" }).click();
  const part = tasks.getByRole("dialog");
  await part.getByRole("textbox", { name: "Title" }).fill("Remedial");
  await part.getByRole("textbox", { name: "Category" }).fill("Remedial bab 1");
  await part
    .getByRole("textbox", { name: "What to do" })
    .fill("Kerjakan soal 1 lagi.");
  await chooseDay(tasks, part.getByLabel("Deadline"), "2027-10-30");
  await part.getByRole("combobox", { name: "Time" }).click();
  await tasks.getByRole("option", { name: LATE_EVENING }).click();
  await part.getByRole("combobox", { name: "Who gets it" }).click();
  await tasks.getByRole("option", { name: "Some students" }).click();
  const publish = part.getByRole("button", { name: "Publish" });
  await expect(publish).toBeDisabled();
  await part.getByRole("checkbox", { name: "Acceptance Learner" }).click();
  await publish.click();
  await expect(
    tasks.getByRole("button", { exact: true, name: "Remedial" })
  ).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    tasks.getByRole("cell", { name: "Remedial bab 1" })
  ).toBeVisible();
  await teacher.close();

  const taskAddress = address("/classes/fisika-x-1/tasks/latihan-gerak-lurus");
  const page = await learner.newPage();
  await page.goto(address("/classes/fisika-x-1/tasks"));
  await expect(page.getByRole("button", { name: "Remedial" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await page.goto(taskAddress);
  // The task's address opens the list with the task in the pane, and Hand in stands in the pane's footer.
  const pane = page.getByRole("complementary", { name: "Task" });
  const field = pane.getByRole("textbox", { name: "Your work" });
  await waitUntilTakenOver(field);
  const footer = pane.locator("footer");
  const handIn = footer.getByRole("button", { name: "Hand in" });
  await expect(handIn).toBeDisabled();
  await watchLabels(footer);

  await field.fill("1. B, 2. D, 3. A");
  await handIn.click();
  // The work shows as handed in at once and stays in the field, and Hand in waits for new work.
  await expect(pane.getByText("Handed in", { exact: true })).toBeVisible();
  await expect(field).toHaveValue("1. B, 2. D, 3. A");
  await expect(handIn).toBeDisabled();

  // A second page reads the task from the server, whose field holds the work handed in.
  const second = await learner.newPage();
  await second.goto(taskAddress);
  await expect(second.getByRole("textbox", { name: "Your work" })).toHaveValue(
    "1. B, 2. D, 3. A",
    { timeout: readinessTimeoutMilliseconds }
  );
  await second.close();

  await field.fill("1. B, 2. C, 3. A");
  await expect(handIn).toBeEnabled();
  await handIn.click();
  await expect(field).toHaveValue("1. B, 2. C, 3. A");
  await expect(handIn).toBeDisabled();
  const third = await learner.newPage();
  await third.goto(taskAddress);
  await expect(third.getByRole("textbox", { name: "Your work" })).toHaveValue(
    "1. B, 2. C, 3. A",
    { timeout: readinessTimeoutMilliseconds }
  );
  await third.close();

  expect(await shownLabels(page)).toEqual([["Hand in"]]);
  await learner.close();
});
