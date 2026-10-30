import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { closeSitting } from "@/e2e/support/proctor";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The name that the acceptance runtime gives every learner it invites. */
const LEARNER_NAME = "Acceptance Learner";

/** The essay the student writes for the seeded essay question, the third of the paper. */
const ESSAY = "Tumbuhan mengubah cahaya matahari menjadi energi kimia.";

test("a student writes an essay, the teacher grades it with part of its points, and the student sees the grade", async ({
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
  const teacherContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(teacherContext, school.slug, address("/"))
  );
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "essay")
  );

  // The student writes the essay in its area, and the paper keeps it once the student pauses.
  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  const navigator = student.getByRole("complementary", { name: "Questions" });
  await navigator
    .getByRole("button", { exact: true, name: "Question 3, unanswered" })
    .click();
  const essay = student
    .getByRole("article", { name: "Question 3" })
    .getByRole("textbox", { name: "Question 3" });
  await expect(essay).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await essay.fill(ESSAY);
  await essay.blur();
  await expect(
    navigator.getByRole("button", { exact: true, name: "Question 3, answered" })
  ).toBeVisible();
  await student.getByRole("button", { name: "Finish", exact: true }).click();
  await student
    .getByRole("dialog")
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await expect(student.getByText("Your answers are in.")).toBeVisible();

  // The teacher closes the sitting, reads the essay in the third question's answers, and gives it 3 of 4.
  const teacher = await teacherContext.newPage();
  await teacher.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  await closeSitting(teacher);
  await teacher.getByRole("link", { name: "Results", exact: true }).click();
  // The results list each question's answers in the Questions sheet of the header.
  await teacher.getByRole("button", { name: "Questions", exact: true }).click();
  const questions = teacher.getByRole("dialog", { name: "Questions" });
  await questions
    .getByRole("button", { name: "Question 3", exact: true })
    .click();
  const answers = teacher.getByRole("table").filter({
    has: teacher.getByRole("columnheader", { name: "Points", exact: true }),
  });
  const row = answers.getByRole("row", { name: LEARNER_NAME });
  await expect(row).toContainText(ESSAY, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(row).toContainText("Waiting for review");
  const points = row.getByRole("textbox", {
    name: `Points of ${LEARNER_NAME}`,
  });
  await points.fill("3");
  await points.press("Enter");
  await expect(row).toContainText("Partly correct");
  await teacher.keyboard.press("Escape");
  await expect(questions).toBeHidden();

  // The release shows the student the grade beside the essay.
  await teacher
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await teacher
    .getByRole("dialog")
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await expect(
    student.getByText("Your teacher released these results.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(student.getByText("Partly correct")).toBeVisible();
  await expect(student.getByText(`Your answer: ${ESSAY}`)).toBeVisible();
  await studentContext.close();
  await teacherContext.close();
});
