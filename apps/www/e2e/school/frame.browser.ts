import { type Browser, expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * Seeds a sitting for the learner. The seed opens it in the school's first active unit, which the
 * school has only once its Owner has signed in, so the Owner signs in first, as every proctor
 * spec does.
 */
const seedLearnerSitting = async (
  browser: Browser,
  slug: string,
  home: string,
  learner: string
) => {
  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, slug, home));
  await owner.close();
  return Effect.runPromise(seedSitting(slug, learner));
};

test("a student's sitting screen fills the page under its bar, with its card in the middle of the body", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `frame-${school.slug}@acceptance.example.test`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context,
      slug: school.slug,
    })
  );
  const sitting = await seedLearnerSitting(
    browser,
    school.slug,
    address("/"),
    learner
  );
  const page = await context.newPage();

  await page.goto(address(`/sittings/${sitting.sittingId}`));
  const card = page.locator('[data-slot="card"]').filter({
    has: page.getByRole("button", { name: "Enter sitting" }),
  });
  await expect(card).toBeVisible();
  const body = await page.locator('[data-slot="sidebar-inset"]').boundingBox();
  const box = await card.boundingBox();
  const bodyMiddle = (body?.x ?? 0) + (body?.width ?? 0) / 2;
  const cardMiddle = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  // The card stands in the middle of the page under the bar, across and down, not at its top.
  expect(Math.abs(bodyMiddle - cardMiddle)).toBeLessThanOrEqual(2);
  expect(box?.y ?? 0).toBeGreaterThan(
    ((body?.y ?? 0) + (body?.height ?? 0) - (box?.height ?? 0)) / 3
  );
  await context.close();
});

test("a student's results start at the top of the sitting body, which caps at the app's width and breaks long words", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `outcome-${school.slug}@acceptance.example.test`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1920 },
  });
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context,
      slug: school.slug,
    })
  );
  const sitting = await seedLearnerSitting(
    browser,
    school.slug,
    address("/"),
    learner
  );
  const page = await context.newPage();

  await page.goto(address(`/sittings/${sitting.sittingId}`));
  // The token and the press reach the sitting only once React has taken the entry over.
  const enter = page.getByRole("button", { name: "Enter sitting" });
  await waitUntilTakenOver(enter);
  await page
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await enter.click();
  await page.getByRole("radiogroup").first().getByRole("radio").first().click();
  await page.getByRole("button", { exact: true, name: "Finish" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Finish" })
    .click();
  const done = page.getByText("Your answers are in.");
  await expect(done).toBeVisible();

  const body = page.locator('[data-slot="sitting-body"]');
  const [frame, sentence] = await Promise.all([
    body.boundingBox(),
    done.boundingBox(),
  ]);
  // The body caps at the app's width, and the results start at its top, under the bar.
  expect(frame?.width ?? 0).toBeLessThanOrEqual(1280);
  expect((sentence?.y ?? 0) - (frame?.y ?? 0)).toBeLessThanOrEqual(48);
  await expect(body).toHaveCSS("overflow-wrap", "anywhere");
  await context.close();
});
