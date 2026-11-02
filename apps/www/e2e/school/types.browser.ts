import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { expectNoOverflow } from "@/e2e/support/layout";
import { optionNamed } from "@/e2e/support/player";
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

/** The essay the student writes, which the teacher grades by hand. */
const ESSAY = "Tumbuhan mengubah cahaya, air dan karbon dioksida menjadi gula.";

/** The points of the seeded exam: one for each of its nine keyed questions, and four for its essay. */
const FULL_SCORE = "13 of 13 points";

/** The keys of the digits pad that write three quarters, by their names: zero, the decimal point, seven, five. */
const THREE_QUARTERS_KEYS = ["٠", "Decimal point", "٧", "٥"] as const;

/** One question of the student's paper, by its number. */
const question = (page: Page, number: number) =>
  page.getByRole("article", { name: `Question ${number}` });

/**
 * Answers every question of the seeded exam the way its key reads, from the single choices to the essay, as a
 * student does on the paper: a radio, check boxes, a typed answer, a number on the Arabic digits pad, the pairs,
 * the table's marks, and the essay.
 */
async function answerEveryTemplate(student: Page) {
  // The two single choices: the first option of each is correct.
  for (const number of [1, 2]) {
    await question(student, number).getByRole("radio").first().click();
  }
  // Complex multiple choice: both even numbers.
  for (const text of ["2", "4"]) {
    await question(student, 3)
      .getByRole("checkbox", { name: optionNamed(text) })
      .click();
  }
  // True or false, then cause and effect.
  await question(student, 4)
    .getByRole("radio", { name: optionNamed("Benar") })
    .click();
  await question(student, 5)
    .getByRole("radio", {
      name: optionNamed("Pernyataan dan alasan benar serta berhubungan"),
    })
    .click();
  // A short answer, read without its case.
  const typed = question(student, 6).getByRole("textbox", {
    exact: true,
    name: "Question 6",
  });
  await typed.fill("jakarta");
  await typed.blur();
  // A numeric answer of three quarters, written on the Arabic digits pad, which the server reads as 0.75.
  const number = question(student, 7).getByRole("textbox", {
    exact: true,
    name: "Question 7",
  });
  await number.click();
  await question(student, 7)
    .getByRole("button", { name: "Arabic digits" })
    .click();
  const pad = student.locator('[data-slot="arabic-number-pad"]');
  for (const name of THREE_QUARTERS_KEYS) {
    await pad.getByRole("button", { exact: true, name }).click();
  }
  await expect(number).toHaveValue("٠٫٧٥");
  await student.keyboard.press("Escape");
  await number.blur();
  // Matching: Indonesia with Jakarta (B), Jepang with Tokyo (C), Jerman with Berlin (A).
  for (const [statement, letter] of [
    ["1", "B"],
    ["2", "C"],
    ["3", "A"],
  ] as const) {
    await question(student, 8)
      .getByRole("combobox", { name: `Answer for statement ${statement}` })
      .click();
    await student.getByRole("option", { exact: true, name: letter }).click();
  }
  // The true or false table, one mark for each statement.
  for (const [statement, column] of [
    ["Air mendidih pada 100 derajat Celsius.", "Benar"],
    ["Matahari mengelilingi Bumi.", "Salah"],
    ["Es lebih ringan dari air.", "Benar"],
  ] as const) {
    await question(student, 9)
      .getByRole("radiogroup", { name: statement })
      .getByRole("radio", { exact: true, name: column })
      .click();
  }
  // The essay.
  const essay = question(student, 10).getByRole("textbox", {
    exact: true,
    name: "Question 10",
  });
  await essay.fill(ESSAY);
  await essay.blur();
}

test("a student sits a question of every template, the server scores each one, the teacher grades the essay, and the released results read every one correct", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(300_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `types-${school.slug}@acceptance.example.test`;
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
  const teacherContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(teacherContext, school.slug, address("/"))
  );
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "templates")
  );

  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student.getByPlaceholder("Enter the token").fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  await expect(question(student, 10)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await Effect.runPromise(expectNoOverflow(student, "paper"));
  await answerEveryTemplate(student);
  await test.info().attach("paper", {
    body: await student.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await student.getByRole("button", { exact: true, name: "Finish" }).click();
  await student
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Finish" })
    .click();
  await expect(student.getByText("You finished this exam.")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // The teacher closes the room and gives the essay its four points.
  const teacher = await teacherContext.newPage();
  await teacher.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  await closeSitting(teacher);
  await teacher.getByRole("link", { exact: true, name: "Results" }).click();
  await teacher.getByRole("button", { exact: true, name: "Questions" }).click();
  const questions = teacher.getByRole("dialog", { name: "Questions" });
  await questions.getByRole("combobox").click();
  await teacher
    .getByRole("option", { exact: true, name: "Question 10" })
    .click();
  const answers = teacher.getByRole("table").filter({
    has: teacher.getByRole("columnheader", { exact: true, name: "Points" }),
  });
  const row = answers.getByRole("row", { name: LEARNER_NAME });
  await expect(row).toContainText(ESSAY, {
    timeout: readinessTimeoutMilliseconds,
  });
  const points = row.getByRole("textbox", {
    name: `Points of ${LEARNER_NAME}`,
  });
  await points.fill("4");
  await points.press("Enter");
  await expect(row).toContainText("Correct");
  await teacher.keyboard.press("Escape");
  await expect(questions).toBeHidden();
  await teacher
    .getByRole("button", { exact: true, name: "Release results" })
    .click();
  await teacher
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Release results" })
    .click();

  // The student reads every question correct and the full score, with no sideways scroll.
  await expect(
    student.getByText("Your teacher released these results.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(student.getByText(FULL_SCORE)).toBeVisible();
  await expect(student.getByText("Correct", { exact: true })).toHaveCount(10);
  await expect(student.getByText("Incorrect", { exact: true })).toHaveCount(0);
  await Effect.runPromise(expectNoOverflow(student, "results"));
  await test.info().attach("results", {
    body: await student.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await studentContext.close();
  await teacherContext.close();
});
