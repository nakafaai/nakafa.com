import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The name that the acceptance runtime gives every learner it invites. */
const LEARNER_NAME = "Acceptance Learner";

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`an invite whose term ended lets nobody in, shows as expired to the Owner, and a new invite goes out from its row, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);

    // The learner's invite ends before the account signs in, so the account is no member of the school.
    const learnerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      inviteLearner({
        address: `expired-${viewport.width}-${school.slug}@acceptance.example.test`,
        baseURL: address("/"),
        context: learnerContext,
        expired: true,
        slug: school.slug,
      })
    );
    const learner = await learnerContext.newPage();
    await learner.goto(address("/"));
    await expect(
      learner.getByRole("heading", { name: `Not a member of ${school.name}` })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await test.info().attach(`learner-${viewport.width}`, {
      body: await learner.screenshot(),
      contentType: "image/png",
    });
    await learnerContext.close();

    // The Owner reads the invite as expired in place of its end, and sends it again from its row.
    const ownerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(ownerContext, school.slug, address("/"))
    );
    const owner = await ownerContext.newPage();
    await owner.goto(address("/settings/invites"));
    const row = owner.getByRole("row").filter({ hasText: LEARNER_NAME });
    await expect(row).toContainText("Expired", {
      timeout: readinessTimeoutMilliseconds,
    });
    await test.info().attach(`owner-expired-${viewport.width}`, {
      body: await owner.screenshot(),
      contentType: "image/png",
    });
    const more = row.getByRole("button", { name: "More actions" });
    await waitUntilTakenOver(more);
    await more.click();
    await owner.getByRole("menuitem", { name: "Send again" }).click();
    // An expired invite is never sent again: the school invites the person anew. This account already holds the
    // address, so it claims the new invite at once, and the person leaves the invites for the members.
    await expect(row).toHaveCount(0, {
      timeout: readinessTimeoutMilliseconds,
    });
    await owner.goto(address("/settings/members"));
    await expect(
      owner.getByRole("row").filter({ hasText: LEARNER_NAME })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await test.info().attach(`owner-sent-${viewport.width}`, {
      body: await owner.screenshot(),
      contentType: "image/png",
    });
    await ownerContext.close();
  });
}
