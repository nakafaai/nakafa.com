import { expect, type Page, test } from "@playwright/test";
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

/** How long the proctor's panel says the student was away, in seconds or minutes. */
const AWAY_FOR = /Left the exam for \d+ (?:s|min)/u;

/** Tells the page that its tab is hidden or shown again, as a browser does when the student leaves or returns. */
async function setVisibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate((visibility) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: visibility,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

test("a proctor sees the question on a student's screen with the student's answer, and how long the student was away", async ({
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
  const proctorContext = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
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

  // The proctor's panel draws the student's screen from its data: the question in view and its prompt.
  const proctor = await proctorContext.newPage();
  await proctor.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  // The seat is pressed as soon as it shows, as a proctor does: it is a link, so it opens the panel
  // whether or not the page's script has run.
  await proctor
    .getByRole("list", { name: "Student seats" })
    .getByRole("link", { name: LEARNER_NAME })
    .click();
  const screen = proctor.locator("section", { hasText: "Student screen" });
  await expect(screen).toContainText("Question 1", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(screen).toContainText("Soal pertama.");

  // The student moves to the second question and answers it, and the panel follows.
  const navigator = student.getByRole("complementary", { name: "Questions" });
  await navigator
    .getByRole("button", { exact: true, name: "Question 2, unanswered" })
    .click();
  await expect(screen).toContainText("Question 2", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(screen).toContainText("Soal kedua");
  await student
    .getByRole("article", { name: "Question 2" })
    .getByRole("radio")
    .first()
    .click();
  await expect(screen.getByRole("radio").first()).toBeChecked({
    timeout: readinessTimeoutMilliseconds,
  });

  // The student leaves the tab and comes back, and the panel says for how long.
  await setVisibility(student, "hidden");
  await student.waitForTimeout(2000);
  await setVisibility(student, "visible");
  await expect(proctor.getByText(AWAY_FOR)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  await studentContext.close();
  await proctorContext.close();
});
