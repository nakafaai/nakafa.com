import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { closeSitting } from "@/e2e/support/proctor";
import { giveRole } from "@/e2e/support/roles";
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

/** The heading of the school's not-found page, which a viewer without the grant meets. */
const NOT_FOUND = "We can't find this page";

/** The name of the seeded exam's open room, which its rooms list links. */
const ROOM = "Lab 2";

/** The row of the seeded exam's room for tomorrow, which is still scheduled. */
const UPCOMING_ROW = /Lab 3/u;

test("a person whose only role is Proctor runs a room end to end, and is refused moving or cancelling a room, the exam's editor, its list and its results", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(240_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);

  // The Proctor is the only learner of the school when the Owner gives the role, so the picker names one person.
  const proctorContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: `proctor-${school.slug}@acceptance.example.test`,
      baseURL: address("/"),
      context: proctorContext,
      slug: school.slug,
    })
  );
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const owner = await ownerContext.newPage();
  await owner.goto(address("/settings/roles"));
  await giveRole(owner, { person: LEARNER_NAME, role: "Proctor" });
  await ownerContext.close();

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
  // The seed also schedules a room of the exam for tomorrow, which only those who schedule the exam move or cancel.
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "upcoming")
  );
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

  // The Proctor finds the rooms of the exam, and moves and cancels none of them.
  const proctor = await proctorContext.newPage();
  await proctor.goto(address(`/exams/${sitting.examId}`));
  const upcoming = proctor.getByRole("row", { name: UPCOMING_ROW });
  await expect(upcoming).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  const menu = upcoming.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(menu);
  await menu.click();
  await expect(
    proctor.getByRole("menuitem", { name: "Reschedule" })
  ).toBeDisabled();
  await expect(
    proctor.getByRole("menuitem", { name: "Cancel room" })
  ).toBeDisabled();
  await proctor.keyboard.press("Escape");

  // The Proctor opens the room that is open now.
  const roomLink = proctor
    .getByRole("table")
    .getByRole("link", { exact: true, name: ROOM });
  await expect(roomLink).toHaveAttribute(
    "href",
    `/exams/${sitting.examId}/sittings/${sitting.sittingId}`,
    { timeout: readinessTimeoutMilliseconds }
  );
  await roomLink.click();
  await proctor.waitForURL(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );

  // The room's token is the Proctor's to change.
  const token = proctor.locator("header").getByRole("button", {
    name: `Show the room's QR code, token ${sitting.token}`,
  });
  await waitUntilTakenOver(token);
  await token.click();
  const room = proctor.getByRole("dialog", { name: "Join this room" });
  await room.getByRole("button", { name: "Change token" }).click();
  await proctor
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Change token" })
    .click();
  await expect(
    proctor
      .getByRole("dialog", { name: "Join this room" })
      .getByText(sitting.token, { exact: true })
  ).toHaveCount(0, { timeout: readinessTimeoutMilliseconds });
  await proctor
    .getByRole("dialog", { name: "Join this room" })
    .locator('[data-slot="dialog-footer"]')
    .getByRole("button", { exact: true, name: "Close" })
    .click();

  // The Proctor locks the student's attempt, and unlocks it again.
  await proctor
    .getByRole("list", { name: "Student seats" })
    .getByRole("link", { name: LEARNER_NAME })
    .click();
  const dialog = proctor.getByRole("dialog");
  await proctor.getByRole("button", { exact: true, name: "Lock" }).click();
  await dialog.getByRole("combobox").click();
  await proctor.getByRole("option", { name: "Rule broken" }).click();
  await dialog.getByRole("button", { name: "Lock session" }).click();
  await expect(
    student.getByText(
      "Your proctor locked this attempt, so wait until it is unlocked before you answer."
    )
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await proctor.getByRole("button", { exact: true, name: "Unlock" }).click();
  await dialog.getByRole("combobox").click();
  await proctor.getByRole("option", { name: "Power outage" }).click();
  await dialog.getByRole("button", { name: "Unlock session" }).click();
  await expect(
    student.getByRole("heading", { name: "Question 1" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // The Proctor closes the room, and the student's screen says so.
  await closeSitting(proctor);
  await expect(
    student.getByText(
      "This attempt has closed, so ask your proctor if you think the time was wrong."
    )
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await studentContext.close();

  // The role writes no exam and reads no result: the editor and the exam list are not found, and the results refuse.
  await proctor.goto(address(`/exams/${sitting.examId}/edit`));
  await expect(
    proctor.getByRole("heading", { level: 1, name: NOT_FOUND })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await proctor.goto(address("/exams"));
  await expect(
    proctor.getByRole("heading", { level: 1, name: NOT_FOUND })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await proctor.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}/results`)
  );
  await expect(proctor.getByText("You cannot view these results.")).toBeVisible(
    { timeout: readinessTimeoutMilliseconds }
  );
  await proctorContext.close();
});
