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

/** The first option of one question of the paper that `page` shows. */
function firstOption(page: Page, question: number) {
  return page
    .getByRole("article", { name: `Question ${question}` })
    .getByRole("radio")
    .first();
}

test("a student with a sitting open in two tabs answers in the one that holds the paper, the other says where it is, and takes it over with the answers once that tab closes", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context,
      slug: school.slug,
    })
  );
  // The seed opens the sitting in the school's first active unit, which the school has once its Owner signed in.
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  await ownerContext.close();
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  const first = await context.newPage();
  await first.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    first.getByRole("button", { name: "Enter sitting" })
  );
  await first.getByPlaceholder("Enter the token").fill(sitting.token);
  await first.getByRole("button", { name: "Enter sitting" }).click();
  await expect(firstOption(first, 1)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // The second tab is the same browser, which already holds the attempt, so it needs no entry, and one tab holds
  // the paper, because two would report every switch between them as the student leaving the exam.
  const second = await context.newPage();
  await second.goto(address(`/sittings/${sitting.sittingId}`));
  await expect(
    second.getByText("This exam is open in another tab.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(firstOption(second, 1)).toHaveCount(0);

  await firstOption(first, 1).click();
  await expect(firstOption(first, 1)).toBeChecked();
  await firstOption(first, 2).click();
  await expect(firstOption(first, 2)).toBeChecked();

  // The first tab closes, and the second takes the paper over by itself with both answers.
  await first.close();
  await expect(firstOption(second, 1)).toBeChecked({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(firstOption(second, 2)).toBeChecked();
  await expect(second.getByText("We could not load this data.")).toHaveCount(0);
  await context.close();
});
