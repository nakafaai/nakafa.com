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
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The name that the acceptance runtime gives every learner it invites. */
const LEARNER = "Acceptance Learner";

/** The last quarter hour of a day, as the time list names it in a 12 or a 24 hour locale. */
const LATE_EVENING = /^(?:11:45\sPM|23:45)$/u;

/** Opens the row menu of the learner's row and chooses `item`, once the page has taken it over. */
async function chooseFromRow(page: Page, item: string) {
  const menu = page
    .getByRole("row")
    .filter({ hasText: LEARNER })
    .getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(menu);
  await menu.click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("the school's Owner posts an announcement, publishes a task, enters and releases a grade, writes and approves a report card, and reads Insight, in a class they neither teach nor homeroom", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(240_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
  const seed = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: seed,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learner));
  // The class teacher's sign-in seeds the class Fisika X-1 in the cohort X-1, which the Owner neither teaches nor homerooms.
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));

  // The learner joins X-1, so the class's grades and the cohort's report cards hold a row.
  await page.goto(address("/settings/cohorts"));
  const cohort = page.getByRole("link", { exact: true, name: "X-1" });
  await waitUntilTakenOver(cohort);
  await cohort.click();
  await page
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const placing = page.getByRole("dialog");
  await placing.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: LEARNER }).click();
  await placing.getByRole("button", { name: "Add student" }).click();
  await expect(placing).toBeHidden();

  await page.goto(address("/classes/fisika-x-1"));
  const announce = page.getByRole("button", { name: "New announcement" });
  await expect(announce).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(announce);
  await announce.click();
  const announcement = page.getByRole("dialog");
  await announcement
    .getByRole("textbox", { name: "Announcement" })
    .fill("Rapat orang tua hari Sabtu.");
  await announcement.getByRole("button", { name: "Post" }).click();
  await expect(announcement).toBeHidden();
  await expect(page.getByText("Rapat orang tua hari Sabtu.")).toBeVisible();

  await page.goto(address("/classes/fisika-x-1/tasks"));
  const create = page.getByRole("button", { name: "New task" });
  await expect(create).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(create);
  await create.click();
  const task = page.getByRole("dialog");
  await task
    .getByRole("textbox", { name: "Title" })
    .fill("Latihan Gerak Lurus");
  await task
    .getByRole("textbox", { name: "What to do" })
    .fill("Kerjakan soal 1 sampai 10.");
  await chooseDay(page, task.getByLabel("Deadline"), "2027-10-30");
  await task.getByRole("combobox", { name: "Time" }).click();
  await page.getByRole("option", { name: LATE_EVENING }).click();
  await task.getByRole("button", { name: "Publish" }).click();
  await expect(task).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Latihan Gerak Lurus" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  await page.goto(address("/classes/fisika-x-1/grades"));
  const gradeRow = page.getByRole("row").filter({ hasText: LEARNER });
  const grade = gradeRow.getByRole("textbox");
  await expect(grade).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(grade);
  await grade.fill("88");
  await grade.press("Enter");
  await expect(gradeRow).toContainText("Draft");
  const releasedBefore = changes.sent;
  await chooseFromRow(page, "Release");
  await expect(gradeRow).toContainText("Released");
  // The next page closes the connection and drops a change still on its way, so it waits for the server's answer.
  await saved(changes, releasedBefore);

  await page.goto(address("/reports"));
  const reports = page.getByRole("link", { exact: true, name: "X-1" });
  await expect(reports).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await reports.click();
  const reportRow = page.getByRole("row").filter({ hasText: LEARNER });
  await expect(reportRow).toContainText("Not started", {
    timeout: readinessTimeoutMilliseconds,
  });
  await chooseFromRow(page, "Write note");
  const note = page.getByRole("dialog");
  await note.getByLabel("Homeroom teacher's note").fill("Tekun dan rapi.");
  await note.getByRole("button", { name: "Save note" }).click();
  await expect(reportRow).toContainText("Draft");
  await chooseFromRow(page, "Hand in");
  await expect(reportRow).toContainText("Handed in");
  await chooseFromRow(page, "Approve");
  await expect(reportRow).toContainText("Locked", {
    timeout: readinessTimeoutMilliseconds,
  });

  await page.goto(address("/insight"));
  await expect(page.getByRole("combobox", { name: "Class" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page.getByText("No class yet")).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: test.info().outputPath("duties-insight-1440.png"),
  });
  await context.close();
});
