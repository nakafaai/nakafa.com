import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { createSchool, inviteLearner } from "@/e2e/support/school";

/** The sentence an invitation row shows in English. */
const INVITATION = "You have been invited to join this school.";

test("pressing an invitation marks it read before the page moves to the school, and a fresh load shows it read", async ({
  browser,
  baseURL,
}) => {
  const origin = await Effect.runPromise(Effect.fromNullishOr(baseURL));
  const school = await Effect.runPromise(createSchool());
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: `learner-${school.slug}@acceptance.example.test`,
      baseURL: origin,
      context,
      slug: school.slug,
    })
  );
  // The local runtime does not serve the school's host, so a stand-in page answers it.
  // The page really leaves, so a read sent too late would be lost with it.
  await context.route(`https://${school.slug}.nakafa.com/**`, (route) =>
    route.fulfill({
      body: "<!doctype html><title>School</title>",
      contentType: "text/html",
      status: 200,
    })
  );
  const page = await context.newPage();

  await page.goto(new URL("/en/notifications", origin).href);

  const invitation = page.getByRole("link", { name: INVITATION });
  await expect(invitation).toHaveCSS("font-weight", "500");
  expect(new URL(String(await invitation.getAttribute("href"))).hostname).toBe(
    `${school.slug}.nakafa.com`
  );
  const movedToSchool = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() &&
      new URL(request.url()).hostname === `${school.slug}.nakafa.com`
  );
  await invitation.click();
  await movedToSchool;
  await page.waitForURL(`https://${school.slug}.nakafa.com/**`);
  // The press saved the read before the page left: a fresh load shows the row read.
  await page.goto(new URL("/en/notifications", origin).href);
  await expect(page.getByRole("link", { name: INVITATION })).toHaveCSS(
    "font-weight",
    "400"
  );
  await context.close();
});

test("Mark all as read marks both invitations of one learner read", async ({
  browser,
  baseURL,
}) => {
  const origin = await Effect.runPromise(Effect.fromNullishOr(baseURL));
  const first = await Effect.runPromise(createSchool());
  const second = await Effect.runPromise(createSchool());
  // Both schools invite the same address, so one account holds two invitations.
  const address = `learner-${first.slug}@acceptance.example.test`;
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({ address, baseURL: origin, context, slug: first.slug })
  );
  await Effect.runPromise(
    inviteLearner({ address, baseURL: origin, context, slug: second.slug })
  );
  const page = await context.newPage();

  await page.goto(new URL("/en/notifications", origin).href);

  const invitations = page.getByRole("link", { name: INVITATION });
  await expect(invitations).toHaveCount(2);
  await expect(invitations.nth(0)).toHaveCSS("font-weight", "500");
  await expect(invitations.nth(1)).toHaveCSS("font-weight", "500");
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(invitations.nth(0)).toHaveCSS("font-weight", "400");
  await expect(invitations.nth(1)).toHaveCSS("font-weight", "400");
  await context.close();
});

test("an empty inbox shows Nina asleep beside its sentence and offers no action", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* openChatPage(page, origin);
      yield* Effect.promise(async () => {
        await page.goto("/en/notifications");
        const empty = page.getByText("You have no notifications yet.");
        await expect(empty).toBeVisible({ timeout: 30_000 });
        await expect(
          page.locator('[data-slot="empty"] [data-slot="empty-icon"] svg')
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Mark all as read" })
        ).toHaveCount(0);
      });
    })
  );
});
