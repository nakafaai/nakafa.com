import type { Locator } from "@playwright/test";
import { waitForStill } from "@/e2e/support/quiet";

/**
 * Waits until nothing moves the element: no animation of the page's clock runs on it or on an element that holds it,
 * such as the sheet it rises in, and then it holds its place for a few frames. An animation that runs forever, or one
 * that a scroll drives, never ends by itself, so it does not count.
 */
async function waitForSettled(target: Locator) {
  await target.evaluate(async (element) => {
    const moving = () =>
      document.getAnimations().filter((animation) => {
        const effect = animation.effect;
        return (
          animation.playState === "running" &&
          animation.timeline instanceof DocumentTimeline &&
          effect instanceof KeyframeEffect &&
          effect.target instanceof Element &&
          effect.target.contains(element) &&
          effect.getComputedTiming().iterations !== Number.POSITIVE_INFINITY
        );
      });
    // A sheet that lays itself out again replaces its motion, so the wait looks again once each motion ends.
    for (let running = moving(); running.length > 0; running = moving()) {
      await Promise.allSettled(running.map((animation) => animation.finished));
    }
  });
  await waitForStill(target);
}

/**
 * Presses a control inside a popup, such as a menu's item, a select's option or a dialog's field, once the popup has
 * settled. On a phone the popup rises as a sheet, which first rests below the screen and then slides up. Playwright
 * counts a control that holds its place for two frames as stable, so a plain press in that rest finds the control
 * outside the viewport and scrolls it into view, which scrolls the sheet's host and swipes the sheet away. Elsewhere
 * the popup has nothing to wait for.
 */
export async function pressInPopup(control: Locator) {
  await control.waitFor();
  await waitForSettled(control);
  await control.click();
}
