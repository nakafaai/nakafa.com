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
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The name that the acceptance runtime gives every learner it invites. */
const LEARNER_NAME = "Acceptance Learner";

/**
 * The seeded sitting holds two choice questions, and the first option of each is the correct answer. The
 * student answers the first question correctly and leaves the second unanswered, so the score is one of two.
 */
const SCORE = "1 of 2 correct";

test("a student finishes a sitting, the proctor closes it and releases its results, and the student sees the score", async ({
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
  await student
    .getByRole("radiogroup")
    .first()
    .getByRole("radio")
    .first()
    .click();
  await student.getByRole("button", { name: "Finish", exact: true }).click();
  await student
    .getByRole("dialog")
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await expect(student.getByText("Your answers are in.")).toBeVisible();
  await expect(
    student.getByText(
      "Your teacher releases the results after the sitting closes."
    )
  ).toBeVisible();

  const proctor = await proctorContext.newPage();
  await proctor.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  await proctor
    .getByRole("button", { name: "Close sitting", exact: true })
    .click();
  await proctor
    .getByRole("dialog")
    .getByRole("button", { name: "Close sitting", exact: true })
    .click();
  await proctor.getByRole("link", { name: "Results", exact: true }).click();

  // The page holds two tables, the students and the answers of the first question,
  // so the roster is the one with a Score column.
  const students = proctor.getByRole("table").filter({
    has: proctor.getByRole("columnheader", { name: "Score", exact: true }),
  });
  await expect(students).toContainText(LEARNER_NAME, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(students.getByRole("row", { name: LEARNER_NAME })).toContainText(
    "1 / 2"
  );
  await proctor
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await proctor
    .getByRole("dialog")
    .getByRole("button", { name: "Release results", exact: true })
    .click();

  await expect(
    student.getByText("Your teacher released these results.")
  ).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(student.getByText(SCORE)).toBeVisible();

  await studentContext.close();
  await proctorContext.close();
});
