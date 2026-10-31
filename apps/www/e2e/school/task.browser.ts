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
const LATE_EVENING = /^(11:45\sPM|23:45)$/u;

/** The address of the task the test publishes. */
const TASK_PATH = /\/classes\/fisika-x-1\/tasks\/latihan-gerak-lurus$/;

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
  test(`a subject teacher publishes a task, finds it in the class's tasks, opens its page, and edits it from the header, at ${viewport.width} px`, async ({
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

    const link = page.getByRole("link", { name: "Latihan Gerak Lurus" });
    await expect(link).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(page.getByText("0 handed in")).toBeVisible();
    await link.click();
    await page.waitForURL(TASK_PATH);
    await expect(
      page.getByRole("heading", { name: "Latihan Gerak Lurus", level: 2 })
    ).toBeVisible();
    await expect(page.getByText("Kerjakan soal 1 sampai 10.")).toBeVisible();
    await expect(page.getByText("No work yet")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toContainText("Latihan Gerak Lurus");

    // Edit task in the header opens the task as it stands, saves only a change, and keeps the task's address.
    const edit = page
      .locator("header")
      .getByRole("button", { name: "Edit task" });
    await waitUntilTakenOver(edit);
    await edit.click();
    const dialog = page.getByRole("dialog");
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
    await expect(
      page.getByRole("main").getByText("Kerjakan soal 1 sampai 5.")
    ).toBeVisible();
    // The server keeps the edit once it answered: a reload drops a change still on its way.
    await saved(changes, editedBefore);
    await page.reload();
    await page.waitForURL(TASK_PATH);
    await expect(page.getByText("Kerjakan soal 1 sampai 5.")).toBeVisible({
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
  await teacher.close();

  const taskAddress = address("/classes/fisika-x-1/tasks/latihan-gerak-lurus");
  const page = await learner.newPage();
  await page.goto(taskAddress);
  const field = page.getByRole("textbox", { name: "Your work" });
  await waitUntilTakenOver(field);
  const form = page.locator("form").filter({ has: field });
  const handIn = form.getByRole("button", { name: "Hand in" });
  await expect(handIn).toBeDisabled();
  await watchLabels(form);

  await field.fill("1. B, 2. D, 3. A");
  await handIn.click();
  // The work shows as handed in at once and stays in the field, and Hand in waits for new work.
  await expect(page.getByText("Handed in", { exact: true })).toBeVisible();
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
