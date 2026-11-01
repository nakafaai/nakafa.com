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

/** The menu of a question's type, which a locked exam does not offer. */
const QUESTION_TYPE = /^Question type/u;

test("an exam a finished sitting locked says so in its header, and its copy takes changes", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `lock-${school.slug}@acceptance.example.test`;
  const student = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: student,
      slug: school.slug,
    })
  );
  await student.close();
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  const page = await context.newPage();

  // A sitting that closes freezes its exam.
  await page.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  const more = page.getByRole("button", { name: "More actions" }).first();
  await waitUntilTakenOver(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Close sitting" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close sitting" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden({
    timeout: readinessTimeoutMilliseconds,
  });

  // The header says it, and says what comes next, and nothing on the page offers a change.
  await page.goto(address(`/exams/${sitting.examId}/edit`));
  const locked = page.getByRole("button", { name: "Locked" });
  await expect(locked).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(
    page.getByRole("button", { exact: true, name: "Add question" })
  ).toHaveCount(0);
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: QUESTION_TYPE })).toHaveCount(
    0
  );
  await locked.click();
  await expect(
    page.getByText("A sitting of this exam has finished")
  ).toBeVisible();

  // The copy stands apart from the exam, with its questions, and takes changes.
  await page.getByRole("button", { name: "Duplicate exam" }).click();
  await expect
    .poll(() => page.url(), { timeout: readinessTimeoutMilliseconds })
    .not.toContain(sitting.examId);
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await expect(page.getByRole("button", { name: "Locked" })).toHaveCount(0);
  await expect(prompt).toContainText("Soal pertama.");
  await context.close();
});
