import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, inviteLearner } from "@/e2e/support/school";

/** The sentence an invitation row shows in English. */
const INVITATION = "You have been invited to join this school.";

test("pressing an invitation marks it read before the page moves to the school, and the read stays after a reload", async ({
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
  // The local runtime does not serve the school's host. The navigation that the press
  // starts gets an empty answer, which keeps this page on the screen, so the test
  // checks where the press goes and never follows the link.
  await context.route(`https://${school.slug}.nakafa.com/**`, (route) =>
    route.fulfill({ status: 204 })
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
  await expect(invitation).toHaveCSS("font-weight", "400");
  await page.reload();
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
