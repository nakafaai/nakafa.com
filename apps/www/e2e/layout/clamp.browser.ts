import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { finishOnboarding } from "@/e2e/support/onboarding";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const SET = "/en/try-out/indonesia/snbt/2027/utbk/set-1";
const LONG_SECTION = "General Knowledge and Understanding";
const LONG_TITLE = "Expected Value of a Normal Distribution";
const LONG_DESCRIPTION =
  "The expected value of a normal distribution is its mean. Prove it with symmetry and an integral, then use it for scaling, sums, and variance.";

/**
 * Measures the text box and the row separately. An ancestor can clip a row without ellipsizing its text. A row is a
 * link, or the button of a try-out part that opens its dialog before its clock starts.
 */
const verifyEllipsis = async (line: Locator) => {
  await expect(line).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  const geometry = await line.evaluate((element) => {
    const row = element.closest("a, button");
    const card = row?.closest('[data-slot="card"],section');
    if (!(row && card)) {
      return null;
    }
    const box = element.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const { paddingLeft, paddingRight } = getComputedStyle(row);
    const start = rowBox.left + Number.parseFloat(paddingLeft);
    const end = rowBox.right - Number.parseFloat(paddingRight);
    const style = getComputedStyle(element);
    return {
      clippedText:
        style.textOverflow === "ellipsis" &&
        style.whiteSpace === "nowrap" &&
        element.scrollWidth > element.clientWidth + 1,
      contentFits: Array.from(row.children).every((child) => {
        const bounds = child.getBoundingClientRect();
        return bounds.left >= start - 1 && bounds.right <= end + 1;
      }),
      rowFits: rowBox.left >= cardBox.left && rowBox.right <= cardBox.right,
      textFits: box.left >= start - 1 && box.right <= end + 1,
    };
  });
  expect(geometry).toEqual({
    clippedText: true,
    contentFits: true,
    rowFits: true,
    textFits: true,
  });
};

test("a long try-out part ends in an ellipsis when the set path has little room", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.promise(async () => {
        await page.setViewportSize({ height: 844, width: 320 });
        await page.goto(SET);
        // The set's address opens its pane, whose path names each part in one line with its full name as a title.
        // The pane draws beside the list on a desktop and in a sheet on a phone, so the part is read where it shows.
        const title = page
          .getByTitle(LONG_SECTION, { exact: true })
          .filter({ visible: true });
        await verifyEllipsis(title);
        await expect(title).toHaveAttribute("title", LONG_SECTION);

        await page.setViewportSize({ height: 900, width: 1440 });
        // The phone's sheet leaves as the pane moves beside the list.
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const list = page.locator("section").filter({ has: title }).last();
        // The same path can be squeezed in the resizable pane beside the table on a desktop.
        await list.evaluate((element) => {
          element.style.maxInlineSize = "16rem";
        });
        await verifyEllipsis(title);
      })
    )
  );
});

test("the home row fits a long title and description beside its icon on a phone", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(signInLearner(page.context(), String(baseURL)));
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.promise(async () => {
        await finishOnboarding(page);
        await page.setViewportSize({ height: 844, width: 320 });
        await page.goto("/en/home");
        // A new learner uses the same row and text styles as a recent lesson.
        const card = page.locator('[data-slot="card"]').filter({
          has: page.getByRole("heading", {
            exact: true,
            name: en.Common.subject,
          }),
        });
        const row = card
          .locator("a")
          .filter({ has: page.getByRole("heading", { level: 3 }) });
        const title = row.getByRole("heading", { level: 3 });
        const description = row.locator("h3 + span");
        await expect(title).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await title.evaluate((element, name) => {
          element.textContent = name;
        }, LONG_TITLE);
        await description.evaluate((element, text) => {
          element.textContent = text;
        }, LONG_DESCRIPTION);
        await verifyEllipsis(title);
        await verifyEllipsis(description);
      })
    )
  );
});
