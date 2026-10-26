import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The prompts of the three questions, in their order. */
const PROMPTS = ["Soal satu", "Soal dua", "Soal tiga"] as const;

/** The exams list on the school host, where a deleted exam's pages lead back to. */
const EXAMS_PATH = /\/exams$/;

/** A proctor's dashboard of one room on the school host. */
const SITTING_PATH = /\/sittings\/[^/]+$/u;

/** The end of an editor's address, which its exam's other pages leave out. */
const EDIT_SUFFIX = /\/edit$/u;

/** The sentence each page of an exam says once the exam is deleted while the page is open. */
const GONE =
  "This exam was deleted or closed to you, so nothing you change here is saved.";

/** The sentence a proctor reads on the dashboard of a room that was cancelled. */
const SITTING_REFUSED = "You cannot view this sitting.";

/** The sentence a student reads on the page of a sitting that was cancelled. */
const STUDENT_REFUSED =
  "This sitting is not open to you, so ask your teacher if you think this is wrong.";

/** The room the seed schedules for the next day, which a teacher may still cancel. */
const UPCOMING_ROOM = "Lab 3";

/** The sentence a paper shows once the proctor let another device take the attempt. */
const RETIRED =
  "Your proctor retired this device, so ask your proctor which device you may use.";

/** Creates an exam of three questions with their prompts in a new school, and waits until the server holds them. */
async function examOfThree(page: Page, baseURL: string | undefined) {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  await Effect.runPromise(
    signInOwner(page.context(), school.slug, hostAddress(baseURL, host, "/"))
  );
  const changes = await Effect.runPromise(trackChanges(page, []));
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Penghapusan");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const sentBefore = changes.sent;
  for (let index = 0; index < PROMPTS.length; index += 1) {
    if (index > 0) {
      await page
        .getByRole("button", { name: "Add question", exact: true })
        .click();
    }
    const text = page.getByRole("textbox", {
      name: `Question ${index + 1} text`,
    });
    await expect(text).toBeEditable({ timeout: readinessTimeoutMilliseconds });
    await text.click();
    await page.keyboard.type(PROMPTS[index] ?? "");
  }
  await saved(changes, sentBefore);
  return { host, school };
}

/** The page header, where each page of a school names its subject. */
const headerOf = (page: Page) =>
  page.locator('header[data-slot="page-header"]');

test.describe("at 1440", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("a teacher who removes the question they are on moves to the next one, and the panel follows", async ({
    baseURL,
    page,
  }) => {
    await examOfThree(page, baseURL);
    const panel = page.getByRole("complementary", { name: "For teachers" });

    // The teacher works on the second question, which the panel names.
    await page.getByRole("textbox", { name: "Question 2 text" }).click();
    await expect(panel).toContainText("Question 2");

    await page.getByRole("button", { name: "Remove question 2" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { exact: true, name: "Remove question" })
      .click();

    // The third question takes the second place, and the teacher stays there, not on the first.
    await expect(
      page.getByRole("region", { name: "Question 2", exact: true })
    ).toContainText(PROMPTS[2]);
    await expect(panel).toContainText("Question 2");
    await expect(
      panel.getByRole("button", {
        name: "Mark option A of question 2 as correct",
      })
    ).toBeVisible();
  });
});

test("a device the proctor retired says so and offers no Finish, while the attempt goes on elsewhere", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  // The seed records its exam as made by the school's Owner, who must have signed in first.
  const proctorContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(proctorContext, school.slug, address("/"))
  );
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  await expect(
    student.getByRole("heading", { name: "Question 1" })
  ).toBeVisible();
  await expect(
    student.getByRole("button", { exact: true, name: "Finish" })
  ).toBeVisible();

  const proctor = await proctorContext.newPage();
  await proctor.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  await proctor.getByRole("button", { name: "Acceptance Learner" }).click();
  await proctor
    .getByRole("button", { exact: true, name: "Allow a second device" })
    .click();
  await proctor
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Allow device" })
    .click();

  await expect(student.getByText(RETIRED)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    student.getByRole("button", { exact: true, name: "Finish" })
  ).toHaveCount(0);

  await studentContext.close();
  await proctorContext.close();
});

test("an exam deleted in another tab keeps its editor, try and rooms on screen with their title, says so, and leads back to the exams", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  const page = await context.newPage();
  const { host } = await examOfThree(page, baseURL);
  const editorUrl = page.url();
  const examPath = new URL(editorUrl).pathname.replace(EDIT_SUFFIX, "");

  const trying = await context.newPage();
  await trying.goto(hostAddress(baseURL, host, `${examPath}/try`));
  await expect(trying.getByText(PROMPTS[0])).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const rooms = await context.newPage();
  await rooms.goto(hostAddress(baseURL, host, examPath));
  await expect(headerOf(rooms)).toContainText("Penghapusan", {
    timeout: readinessTimeoutMilliseconds,
  });

  // The teacher deletes the exam from a second editor, which leaves for the exams list.
  const deleter = await context.newPage();
  await deleter.goto(editorUrl);
  await waitUntilTakenOver(
    deleter.getByRole("button", { name: "More actions" })
  );
  await deleter.getByRole("button", { name: "More actions" }).click();
  await deleter.getByRole("menuitem", { name: "Delete exam" }).click();
  await deleter
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Delete" })
    .click();
  await deleter.waitForURL(EXAMS_PATH);

  // The first editor keeps its title and the text the teacher wrote, locked, under one sentence.
  await expect(page.getByText(GONE)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page.getByText("This exam is not available.")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    "Penghapusan"
  );
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toContainText(PROMPTS[0]);
  await expect(prompt).toHaveAttribute("aria-readonly", "true");
  await expect(
    page.getByRole("button", { name: "Add question", exact: true })
  ).toHaveCount(0);

  // The try and the rooms keep their title and say the same.
  await expect(trying.getByText(GONE)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(trying.getByText("Penghapusan")).toBeVisible();
  await expect(trying.getByText(PROMPTS[0])).toBeVisible();
  await expect(rooms.getByText(GONE)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(headerOf(rooms)).toContainText("Penghapusan");

  // The sentence's link leads back to the exams.
  await page
    .locator("p", { hasText: GONE })
    .getByRole("link", { name: "Exams" })
    .click();
  await page.waitForURL(EXAMS_PATH);
  await context.close();
});

test("a room cancelled while its dashboard and a student's page are open says so, keeps the exam's title for the student, and leads the proctor to the rooms", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  const proctorContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(proctorContext, school.slug, address("/"))
  );
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, true)
  );

  // The proctor opens the dashboard of the room that opens tomorrow.
  const proctor = await proctorContext.newPage();
  await proctor.goto(address(`/exams/${sitting.examId}`));
  await proctor.getByRole("link", { exact: true, name: UPCOMING_ROOM }).click();
  await proctor.waitForURL(SITTING_PATH);
  const upcoming = new URL(proctor.url()).pathname.split("/").at(-1) ?? "";

  // The student waits on the room's page, which names the exam.
  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${upcoming}`));
  await expect(headerOf(student)).toContainText(sitting.title, {
    timeout: readinessTimeoutMilliseconds,
  });

  // The teacher cancels the room from the rooms list in another tab.
  const canceller = await proctorContext.newPage();
  await canceller.goto(address(`/exams/${sitting.examId}`));
  await canceller
    .getByRole("row", { name: new RegExp(UPCOMING_ROOM, "u") })
    .getByRole("button", { name: "More actions" })
    .click();
  await canceller.getByRole("menuitem", { name: "Cancel room" }).click();
  await canceller
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Cancel room" })
    .click();

  await expect(student.getByText(STUDENT_REFUSED)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(headerOf(student)).toContainText(sitting.title);

  await expect(proctor.getByText(SITTING_REFUSED)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await proctor.getByRole("link", { exact: true, name: "Rooms" }).click();
  await proctor.waitForURL(new RegExp(`/exams/${sitting.examId}$`, "u"));

  await studentContext.close();
  await proctorContext.close();
});
