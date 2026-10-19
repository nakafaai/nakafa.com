import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The name that the acceptance runtime gives every learner it invites. */
const LEARNER_NAME = "Acceptance Learner";

/** The row of the first room of the seeded exam, which is open, in the rooms list. */
const OPEN_ROOM_ROW = /Lab 2/;

/** Students seated before the learner, more than one dashboard page of 100 holds. */
const CROWD = 101;

test("a student enters a sitting, and the proctor sees the student leave, lock, unlock, and close it", async ({
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
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, CROWD)
  );

  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  await expect(
    student.getByRole("heading", { name: "Question 1" })
  ).toBeVisible();
  await expect(student.getByText("Soal pertama.")).toBeVisible();

  // The student leaves the tab, which the screen reports to the server as a signal.
  await student.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  const proctor = await proctorContext.newPage();
  await proctor.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  // The learner entered after the crowd, so the learner's seat is on the second page, which
  // loads once the end of the seats comes into view.
  const seats = proctor.getByRole("list", { name: "Student seats" });
  const seat = proctor.getByRole("button", { name: LEARNER_NAME });
  await expect(async () => {
    await seats.getByRole("listitem").last().scrollIntoViewIfNeeded();
    await expect(seat).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: readinessTimeoutMilliseconds });
  await expect(seats.getByRole("listitem")).toHaveCount(CROWD + 1);
  await expect(seat).toHaveAttribute("data-frame", "away");
  await seat.click();
  await expect(proctor.getByText("Left the exam")).toBeVisible();

  const dialog = proctor.getByRole("dialog");

  await proctor.getByRole("button", { name: "Lock", exact: true }).click();
  await dialog.getByRole("combobox").click();
  await proctor.getByRole("option", { name: "Rule broken" }).click();
  await dialog.getByRole("button", { name: "Lock session" }).click();
  await expect(seat).toHaveAttribute("data-frame", "locked");
  await expect(
    student.getByText(
      "Your proctor locked this attempt, so wait until it is unlocked before you answer."
    )
  ).toBeVisible();

  await proctor.getByRole("button", { name: "Unlock", exact: true }).click();
  await dialog.getByRole("combobox").click();
  await proctor.getByRole("option", { name: "Power outage" }).click();
  await dialog.getByRole("button", { name: "Unlock session" }).click();
  await expect(
    student.getByRole("heading", { name: "Question 1" })
  ).toBeVisible();

  await proctor
    .getByRole("button", { name: "Close sitting", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Close sitting", exact: true })
    .click();
  // The close moves the attempt to closing, and the student's screen says so at once; the
  // server submits it 75 seconds after its deadline, past what this test waits for.
  await expect(
    student.getByText(
      "This attempt has closed, so ask your proctor if you think the time was wrong."
    )
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  // A reload keeps how the attempt ended, though the closed sitting takes no new entry.
  await student.reload();
  await expect(
    student.getByText(
      "This attempt has closed, so ask your proctor if you think the time was wrong."
    )
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  await studentContext.close();
  await proctorContext.close();
});

test("a proctor lists the rooms of an exam and opens one from the list, and a student finds the open room on the school home", async ({
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
  // The seed opens one room of an exam, and the proctor schedules a second room from its editor.
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  const proctor = await proctorContext.newPage();
  await proctor.goto(address(`/exams/${sitting.examId}/edit`));
  await proctor.getByRole("button", { name: "Schedule" }).click();
  const scheduling = proctor.getByRole("dialog");
  await scheduling.getByRole("textbox", { name: "Room" }).fill("Lab 3");
  await scheduling.getByRole("button", { name: "Schedule" }).click();
  // Once the server saves the room, the editor goes to the exam's rooms, which list both rooms.
  await proctor.waitForURL(new RegExp(`/exams/${sitting.examId}$`));
  await expect(
    proctor.getByRole("heading", { name: "Ujian Acceptance" })
  ).toBeVisible();
  const rooms = proctor.getByRole("table");
  await expect(rooms.getByRole("link", { name: "Lab 2" })).toHaveAttribute(
    "href",
    `/exams/${sitting.examId}/sittings/${sitting.sittingId}`
  );
  await expect(rooms.getByRole("link", { name: "Lab 3" })).toBeVisible();
  await expect(
    rooms
      .getByRole("row", { name: OPEN_ROOM_ROW })
      .getByRole("cell", { exact: true, name: "Open" })
  ).toBeVisible();

  await rooms.getByRole("link", { name: "Lab 2" }).click();
  await proctor.waitForURL(
    new RegExp(`/exams/${sitting.examId}/sittings/${sitting.sittingId}$`)
  );
  // The dashboard's header path returns to the exam's rooms.
  await proctor
    .locator('[data-slot="page-header"]')
    .getByRole("link", { name: "Ujian Acceptance" })
    .click();
  await proctor.waitForURL(new RegExp(`/exams/${sitting.examId}$`));

  const student = await studentContext.newPage();
  await student.goto(address("/"));
  await expect(
    student.getByText("Your sittings", { exact: true })
  ).toBeVisible();
  // The open room comes first in the tile, and its row enters the sitting.
  await expect(
    student.getByRole("link", { name: OPEN_ROOM_ROW }).first()
  ).toHaveAttribute("href", `/sittings/${sitting.sittingId}`);

  await studentContext.close();
  await proctorContext.close();
});

test("a student jumps to a question from the navigator, flags it, and keeps the flag through a reload", async ({
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
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  await expect(
    student.getByRole("heading", { name: "Question 1" })
  ).toBeVisible();

  // The navigator lists both questions, and a number in it makes that question current.
  const navigator = student.getByRole("complementary", { name: "Questions" });
  await navigator
    .getByRole("button", { exact: true, name: "Question 2, unanswered" })
    .click();
  await expect(
    navigator.getByRole("button", {
      exact: true,
      name: "Question 2, unanswered",
    })
  ).toHaveAttribute("aria-current", "step");

  // The second question takes a flag, which the navigator marks as well.
  const second = student.getByRole("article", { name: "Question 2" });
  await second.getByRole("button", { name: "Flag for review" }).click();
  await expect(
    second.getByRole("button", { name: "Flag for review" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    navigator.getByRole("button", {
      exact: true,
      name: "Question 2, unanswered, flagged for review",
    })
  ).toBeVisible();

  // The first question takes an answer, which the navigator shows as answered.
  const first = student.getByRole("article", { name: "Question 1" });
  await first.getByRole("radio").first().click();
  await expect(
    navigator.getByRole("button", { exact: true, name: "Question 1, answered" })
  ).toBeVisible();

  // A reload brings back the flag. The server never holds a flag, so only the browser's kept state can show
  // it. The answer is not checked here: the server may hold it already, so the check would pass either way.
  await student.reload();
  await expect(
    navigator.getByRole("button", {
      exact: true,
      name: "Question 2, unanswered, flagged for review",
    })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // On a phone the navigator opens from the header, and a number in it closes the sheet.
  await student.setViewportSize({ height: 812, width: 375 });
  await student
    .getByRole("button", { name: "Open the question navigator, question 1" })
    .click();
  const sheet = student.getByRole("dialog", { name: "Questions" });
  await sheet
    .getByRole("button", {
      exact: true,
      name: "Question 2, unanswered, flagged for review",
    })
    .click();
  await expect(sheet).toBeHidden();

  await studentContext.close();
  await proctorContext.close();
});
