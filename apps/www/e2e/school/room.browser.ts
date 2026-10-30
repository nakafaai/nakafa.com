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

test("the proctor shows the room's QR code and token, and a changed token comes back in the same view", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `room-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  await studentContext.close();
  // The seed records its exam as made by the school's Owner, who must have signed in first.
  const proctorContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(proctorContext, school.slug, address("/"))
  );
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  const proctor = await proctorContext.newPage();
  await proctor.goto(
    address(`/exams/${sitting.examId}/sittings/${sitting.sittingId}`)
  );
  // The token is the header's button, readable at a glance, and it opens the room's code.
  const token = proctor
    .locator("header")
    .getByRole("button", {
      name: `Show the room's QR code, token ${sitting.token}`,
    });
  await expect(token).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(token).toContainText(sitting.token);
  await waitUntilTakenOver(token);
  await token.click();

  const room = proctor.getByRole("dialog", { name: "Join this room" });
  await expect(
    room.getByRole("img", {
      name: "QR code that opens this room with its token",
    })
  ).toBeVisible();
  await expect(room.getByText(sitting.token, { exact: true })).toBeVisible();

  // Change token asks first, then the same view shows the new token.
  await room.getByRole("button", { name: "Change token" }).click();
  await proctor
    .getByRole("dialog")
    .getByRole("button", { name: "Change token", exact: true })
    .click();
  const changed = proctor.getByRole("dialog", { name: "Join this room" });
  await expect(changed).toBeVisible();
  await expect(changed.getByText(sitting.token, { exact: true })).toHaveCount(
    0,
    { timeout: readinessTimeoutMilliseconds }
  );
  await changed.getByRole("button", { name: "Close", exact: true }).click();
  await expect(changed).toHaveCount(0);
  await proctorContext.close();
});
