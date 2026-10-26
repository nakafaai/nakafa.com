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
