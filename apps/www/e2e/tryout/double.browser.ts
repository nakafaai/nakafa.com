import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { openSurface, runFirstSection } from "@/e2e/support/player";

/** Longer than the dialog's opening, so a dialog the second press closes is gone by then. */
const OPENED_MILLISECONDS = 600;

/**
 * The first press of a double press on Finish opens its dialog, and the second
 * lands on the backdrop that just covered the button. The learner asked for the
 * dialog, so it stays.
 */
test("a double press on finish keeps its dialog open", async ({
  baseURL,
  hasTouch,
  page,
}) => {
  await Effect.runPromise(runFirstSection(page, hasTouch, baseURL ?? ""));

  await page.getByRole("button", { exact: true, name: "Finish" }).dblclick();
  await expect(openSurface(page)).toBeVisible();
  await page.waitForTimeout(OPENED_MILLISECONDS);

  await expect(openSurface(page)).toBeVisible();
});
