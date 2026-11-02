import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { closeSitting } from "@/e2e/support/proctor";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The name of the learner an invite makes. */
const LEARNER_NAME = "Acceptance Learner";

/** A student's points, once a released exam counted. */
const POINTS = /of \d+ points/u;

test("a teacher walks Insight from no class to a real reading, and a student reads only their own standing", async ({
  baseURL,
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);

  // An admin with no class gets the page's first step, and no empty list.
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const owner = await ownerContext.newPage();
  await owner.goto(address("/insight"));
  await expect(owner.getByText("No class yet")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    owner.getByRole("link", { name: "Open classrooms" })
  ).toBeVisible();
  await expect(owner.getByRole("combobox", { name: "Class" })).toHaveCount(0);

  const learner = `raka-${testInfo.testId.slice(0, 6)}@example.com`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learner));
  const student = await learnerContext.newPage();
  await student.goto(address("/insight"));
  await expect(student.getByText("Nothing to show yet")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(student.getByRole("combobox", { name: "Class" })).toHaveCount(0);

  // A teacher lands on their class, and the page says what fills it.
  const teacherContext = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(teacherContext, school.slug, address("/"))
  );
  const teacher = await teacherContext.newPage();
  await teacher.goto(address("/insight"));
  const picker = teacher.getByRole("combobox", { name: "Class" });
  await waitUntilTakenOver(picker);
  await expect(picker).toContainText("Fisika X-1");
  await teacher.getByRole("tab", { name: "Mastery" }).click();
  await expect(teacher.getByText("No released exam yet")).toBeVisible();
  await expect(teacher.getByRole("link", { name: "Open exams" })).toBeVisible();

  // With no exam, Competencies says what comes first, and its footer goes there.
  await teacher.getByRole("button", { name: "Competencies" }).click();
  const tags = teacher.getByRole("dialog");
  await expect(
    tags.getByText("Create an exam first, then name what its questions test.")
  ).toBeVisible();
  await expect(tags.getByRole("link", { name: "Open exams" })).toBeVisible();
  await teacher.keyboard.press("Escape");

  // The learner joins the class, sits an exam, and its results are released.
  await owner.goto(address("/settings/cohorts"));
  await owner.getByRole("link", { name: "X-1" }).click();
  await owner
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const placing = owner.getByRole("dialog", { name: "Add student" });
  await placing.getByRole("combobox", { name: "Student" }).click();
  await owner.getByRole("option", { name: LEARNER_NAME }).click();
  await placing.getByRole("button", { name: "Add student" }).click();
  await expect(placing).toBeHidden();
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  // Competencies names what a question tests before the results are released.
  await teacher.getByRole("button", { name: "Competencies" }).click();
  const question = tags.getByLabel("Question 1");
  await expect(tags.getByRole("combobox", { name: "Exam" })).toContainText(
    sitting.title
  );
  await question.fill("Gerak lurus");
  await tags.getByRole("button", { name: "Done" }).click();
  await expect(tags).toBeHidden();

  await student.goto(address(`/sittings/${sitting.sittingId}`));
  const enter = student.getByRole("button", { name: "Enter sitting" });
  await waitUntilTakenOver(enter);
  await student.getByPlaceholder("Enter the token").fill(sitting.token);
  await enter.click();
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

  await owner.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  await closeSitting(owner);
  await owner.getByRole("link", { name: "Results", exact: true }).click();
  const header = owner.locator("header");
  await header
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Release results", exact: true })
    .click();
  await expect(
    header.getByRole("button", { name: "Released", exact: true })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // Both now read the same exam, the teacher with the class and the student alone.
  await expect(teacher.getByText(LEARNER_NAME).first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(teacher.getByText("Gerak lurus").first()).toBeVisible();
  await expect(
    teacher.getByText(
      "Only teachers see this chance, and it never changes a grade."
    )
  ).toBeVisible();

  await student.goto(address("/insight"));
  await expect(student.getByText(POINTS).first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(student.getByText("Gerak lurus")).toBeVisible();
  // Their name stands in the sidebar's account, and the page itself lists nobody.
  await expect(student.getByRole("main").getByText(LEARNER_NAME)).toHaveCount(
    0
  );

  await ownerContext.close();
  await learnerContext.close();
  await teacherContext.close();
});
