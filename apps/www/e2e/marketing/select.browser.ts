import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { stepTo } from "@/e2e/support/scroll";
import {
  desktopViewport,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/**
 * The School landing's paper names its chosen type as the editor does: the type's icon stands before its label on
 * one line. A block icon would put the label on a second line, where the trigger's fixed height cuts it.
 */
const verifyTypeSelect = Effect.fn("NakafaE2E.verifyTypeSelect")(function* (
  page: Page
) {
  yield* loadMarketingPage(page, "/en/school");
  const types = page
    .locator("#player")
    .getByRole("combobox", { name: "Question types" });
  yield* stepTo(page, types);
  const chosenType = yield* Effect.promise(() =>
    types.evaluate((trigger) => {
      const value = trigger.querySelector('[data-slot="select-value"]');
      const icon = value?.querySelector("svg");
      const label = [...(value?.childNodes ?? [])].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
      );
      if (!(value instanceof HTMLElement && icon && label)) {
        return null;
      }
      const iconBox = icon.getBoundingClientRect();
      const text = document.createRange();
      text.selectNodeContents(label);
      const labelBox = text.getBoundingClientRect();
      const triggerBox = trigger.getBoundingClientRect();
      return {
        labelAfterIcon: labelBox.left >= iconBox.right - 0.5,
        labelInsideTrigger: labelBox.bottom <= triggerBox.bottom - 0.5,
        sameLine: Math.abs(iconBox.top - labelBox.top) < 4,
      };
    })
  );
  yield* Effect.sync(() =>
    expect(chosenType).toEqual({
      labelAfterIcon: true,
      labelInsideTrigger: true,
      sameLine: true,
    })
  );
});

for (const viewport of [desktopViewport, touchViewport]) {
  test.describe(`School player's type select at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: viewportSize(viewport),
    });

    test("keeps the chosen type's icon on its label's line", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyTypeSelect(page))
      );
    });
  });
}
