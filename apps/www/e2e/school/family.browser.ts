import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("a student invites a parent from the Parents page, and the invited parent waits for the check", async ({
  baseURL,
  browser,
}, testInfo) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `raka-${testInfo.testId.slice(0, 6)}@example.com`;
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learner));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));

  await page.goto(address("/family"));
  const invite = page
    .locator("header")
    .getByRole("button", { name: "Invite a parent" });
  await waitUntilTakenOver(invite);
  await expect(page.getByText("No parent is linked yet.")).toBeVisible();
  await invite.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Parent's name").fill("Ibu Siti");
  await dialog.getByLabel("Parent email").fill("ibu@example.com");
  const sentBefore = changes.sent;
  await dialog.getByRole("button", { name: "Invite a parent" }).click();

  // The parent shows at once, and the school's answer keeps them.
  await expect(page.getByText("Ibu Siti")).toBeVisible();
  await expect(page.getByText("Pending")).toBeVisible();
  await saved(changes, sentBefore);
  await page.reload();
  await expect(page.getByText("Ibu Siti")).toBeVisible();
  await context.close();
});
