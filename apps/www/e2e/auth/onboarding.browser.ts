import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { isTakenOver } from "@/e2e/support/window";

/** A laptop screen, the smallest a learner fills the questionnaire on beside the artwork. */
const LAPTOP = { height: 720, width: 1280 };

/** How far the question side of the entry page scrolls, in pixels: nothing when its question fits. */
function panelOverflow(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector("main")?.firstElementChild;
    return panel ? panel.scrollHeight - panel.clientHeight : -1;
  });
}

/** Expects one question of the three on screen, whole, with no broken page in its place. */
async function expectQuestion(page: Page, number: number) {
  await expect(page.getByText(`Question ${number} of 3`)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page.getByText("Something broke")).toHaveCount(0);
  expect(await panelOverflow(page)).toBeLessThanOrEqual(0);
}

/** Chooses an answer and goes on, once React holds the Continue button. */
async function answer(page: Page, choice: string) {
  const next = page.getByRole("button", { name: "Continue" });
  await expect
    .poll(() => isTakenOver(next), { timeout: readinessTimeoutMilliseconds })
    .toBe(true);
  await page.getByText(choice, { exact: true }).click();
  await next.click();
}

test("a signed-in learner answers each onboarding question on one laptop screen, and the page waits for the session instead of breaking", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext({ viewport: LAPTOP });
  await Effect.runPromise(signInLearner(context, String(baseURL)));
  const page = await context.newPage();
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
  await page.goto("/en/onboarding");

  // The live status waits for Convex to hold the session, so a signed-in learner stays on the
  // question instead of meeting the broken page that a status read too early sent.
  await expectQuestion(page, 1);
  await answer(page, "Student");

  // The six regions stand in two columns, so the longest question fits beside the artwork.
  await expectQuestion(page, 2);
  await answer(page, "Indonesia");

  // Back keeps the answer chosen on the earlier question.
  await expectQuestion(page, 3);
  await page.getByRole("button", { name: "Back" }).click();
  await expectQuestion(page, 2);
  await expect(page.getByRole("radio", { name: "Indonesia" })).toBeChecked();
  await context.close();
});
