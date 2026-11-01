import { type Browser, expect, type Page, test } from "@playwright/test";
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

/**
 * How many answers of the sitting the browser keeps because the server has not confirmed them yet, read from
 * the local storage entries that the player writes for the sitting's attempts.
 */
function keptAnswerCount(page: Page, sittingId: string) {
  return page.evaluate((prefix) => {
    let count = 0;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) {
        const kept: { answers: Record<string, unknown> } = JSON.parse(
          localStorage.getItem(key) ?? '{"answers":{}}'
        );
        count += Object.keys(kept.answers).length;
      }
    }
    return count;
  }, `nakafa-sitting-kept:${sittingId}:`);
}

/** Seeds a school with an open sitting and opens its page as a learner who has not entered it. */
async function openSitting(baseURL: string | undefined, browser: Browser) {
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
  // The seed opens the sitting in the school's first active unit, which the school has once its Owner signed in.
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  await ownerContext.close();
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  return { sitting, student, studentContext };
}

test("a student who answers while the connection is lost keeps the answer, and the server takes it once the connection is back", async ({
  baseURL,
  browser,
}) => {
  const { sitting, student, studentContext } = await openSitting(
    baseURL,
    browser
  );
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student.getByPlaceholder("Enter the token").fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  const option = student
    .getByRole("article", { name: "Question 1" })
    .getByRole("radio")
    .first();
  await expect(option).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  // The connection drops; the student answers anyway, the paper takes the answer at once, and the browser
  // keeps it until the server has it.
  await studentContext.setOffline(true);
  await option.click();
  await expect(option).toBeChecked();
  await expect.poll(() => keptAnswerCount(student, sitting.sittingId)).toBe(1);
  await expect(student.getByText("We could not load this data.")).toHaveCount(
    0
  );
  // The student is told the answer waits, in the paper's bar, for as long as the connection is gone.
  const waits = student.getByText(
    "Your changes save once you are back online."
  );
  await expect(waits.first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // Back online, the player sends the kept answer, and the server's confirmation empties the browser's keep.
  await studentContext.setOffline(false);
  await expect
    .poll(() => keptAnswerCount(student, sitting.sittingId), {
      timeout: readinessTimeoutMilliseconds,
    })
    .toBe(0);
  await expect(waits).toHaveCount(0, { timeout: readinessTimeoutMilliseconds });
  // The answer the server holds is the one the paper shows after a reload.
  await student.reload();
  await expect(
    student
      .getByRole("article", { name: "Question 1" })
      .getByRole("radio")
      .first()
  ).toBeChecked({ timeout: readinessTimeoutMilliseconds });
  await studentContext.close();
});

test("a student who presses enter with no connection is told it waits, and reaches the paper once the connection is back", async ({
  baseURL,
  browser,
}) => {
  const { sitting, student, studentContext } = await openSitting(
    baseURL,
    browser
  );
  const enter = student.getByRole("button", { name: "Enter sitting" });
  await waitUntilTakenOver(enter);
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);

  // The browser knows at once that the network is gone, long before the client's socket goes quiet.
  await studentContext.setOffline(true);
  await enter.click();
  await expect(
    student.getByText("You will enter once you are back online.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  await studentContext.setOffline(false);
  await expect(
    student.getByRole("article", { name: "Question 1" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await studentContext.close();
});
