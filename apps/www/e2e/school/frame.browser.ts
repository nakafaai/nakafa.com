import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
} from "@/e2e/support/school";

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
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
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
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  const page = await context.newPage();

  await page.goto(address(`/sittings/${sitting.sittingId}`));
  await page
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await page.getByRole("button", { name: "Enter sitting" }).click();
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
