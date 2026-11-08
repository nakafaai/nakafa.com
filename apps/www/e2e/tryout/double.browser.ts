import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { openSurface, runFirstSection } from "@/e2e/support/player";
import { waitForAnimations } from "@/e2e/support/quiet";

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
  // The dialog's opening has finished, and so has a closing that the second press would have started.
  await waitForAnimations(openSurface(page));

  await expect(openSurface(page)).toBeVisible();
});
