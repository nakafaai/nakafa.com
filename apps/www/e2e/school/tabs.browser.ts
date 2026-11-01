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

/** Reloads `page` until it shows the first option of `question` as chosen, once the other tab's answer is kept. */
async function expectChosenAfterReload(page: Page, question: number) {
  await expect(async () => {
    await page.reload();
    await expect(firstOption(page, question)).toBeChecked({ timeout: 3000 });
  }).toPass({ timeout: readinessTimeoutMilliseconds });
}

test("a student with a sitting open in two tabs answers in both, and each tab keeps the other's answer", async ({
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

  // The second tab is the same browser, which already holds the attempt, so it opens the paper with no entry.
  const second = await context.newPage();
  await second.goto(address(`/sittings/${sitting.sittingId}`));
  await expect(firstOption(second, 1)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  await firstOption(first, 1).click();
  await expect(firstOption(first, 1)).toBeChecked();
  await firstOption(second, 2).click();
  await expect(firstOption(second, 2)).toBeChecked();

  // Neither tab's answer replaces the other's.
  await expectChosenAfterReload(second, 1);
  await expect(firstOption(second, 2)).toBeChecked();
  await expectChosenAfterReload(first, 2);
  await expect(firstOption(first, 1)).toBeChecked();
  for (const page of [first, second]) {
    await expect(page.getByText("We could not load this data.")).toHaveCount(0);
  }
  await context.close();
});
