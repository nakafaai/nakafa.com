import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, inviteLearner } from "@/e2e/support/school";

/** The sentence an invitation row shows in English. */
const INVITATION = "You have been invited to join this school.";

test("an invited learner sees the invitation in bold, presses it, and sees it read, with its link on the school host", async ({
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
  const page = await context.newPage();

  await page.goto(new URL("/en/notifications", origin).href);

  const invitation = page.getByRole("link", { name: INVITATION });
  await expect(invitation).toHaveCSS("font-weight", "500");
  expect(new URL(String(await invitation.getAttribute("href"))).hostname).toBe(
    `${school.slug}.nakafa.com`
  );
  // The browser never leaves this page: the click's default action is cancelled
  // after the row has been pressed, so the press still marks the row read.
  await invitation.evaluate((link) =>
    link.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    })
  );
  await invitation.click();
  await expect(invitation).toHaveCSS("font-weight", "400");
  await context.close();
});

test("Mark all as read marks the unread invitations of the learner read", async ({
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
  const page = await context.newPage();

  await page.goto(new URL("/en/notifications", origin).href);

  const invitation = page.getByRole("link", { name: INVITATION });
  await expect(invitation).toHaveCSS("font-weight", "500");
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(invitation).toHaveCSS("font-weight", "400");
  await context.close();
});
