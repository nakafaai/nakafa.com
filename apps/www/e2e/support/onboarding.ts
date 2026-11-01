import { expect, type Page } from "@playwright/test";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { isTakenOver } from "@/e2e/support/window";

/** The answers of the questionnaire in order, each with the button that goes on. */
const ANSWERS = [
  { choice: "Student", next: "Continue" },
  { choice: "Indonesia", next: "Continue" },
  { choice: "Study", next: "Finish" },
];

/**
 * Answers the questionnaire of a signed-in learner in English, so the learner's home
 * opens. A synthetic learner starts without it, and home sends them here until then.
 */
export async function finishOnboarding(page: Page) {
  await page.goto("/en/onboarding");
  for (const { choice, next } of ANSWERS) {
    const button = page.getByRole("button", { name: next });
    await expect
      .poll(() => isTakenOver(button), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(true);
    await page.getByRole("radio", { name: choice }).check();
    await button.click();
  }
  await page.waitForURL((url) => url.pathname !== "/en/onboarding");
}
