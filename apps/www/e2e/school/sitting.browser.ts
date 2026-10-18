import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";

/** The name that the acceptance runtime gives every learner it invites. */
const LEARNER_NAME = "Acceptance Learner";

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
  const seat = proctor.getByRole("button", { name: LEARNER_NAME });
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
      "Your proctor has locked this sitting, so you cannot answer."
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
  await expect(student.getByText("This attempt has closed.")).toBeVisible();

  await studentContext.close();
  await proctorContext.close();
});
