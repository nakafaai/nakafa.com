import { expect, type Locator, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readFooterActions } from "@/e2e/support/footer";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { compactViewport } from "@/e2e/support/viewport";

/** The destructive card that holds the account deletion, the only one on the page. */
const deletionCard = (page: Page) =>
  page.locator('[data-slot="card"][data-variant="destructive"]');

/** The actions of the deletion card's footer, which hold the delete action. */
const actionsOf = (page: Page) =>
  deletionCard(page).locator('[data-slot="card-footer"] button');

/** The delete action, the button named Delete account. */
const deleteAction = (page: Page) =>
  actionsOf(page).getByRole("button", {
    exact: true,
    name: app.Auth["delete-account"],
  });

/**
 * The top edge of each line that a button's label takes. A label on one line has
 * one top edge, and a label that wraps has one for each of its lines.
 */
function labelTops(action: Locator) {
  return action.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element.lastChild ?? element);
    return Array.from(range.getClientRects(), (rect) => Math.round(rect.top));
  });
}

/** Signs a learner in and opens the settings page, where the deletion card shows. */
const openSettings = Effect.fn("NakafaE2E.openDeletionSettings")(function* (
  page: Page,
  origin: string
) {
  yield* openChatPage(page, origin);
  yield* Effect.promise(async () => {
    await page.goto(appRoutes.settings);
    await expect(deleteAction(page)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });
});

const verifyActionAtLargeText = Effect.fn(
  "NakafaE2E.verifyDeleteActionAtLargeText"
)(function* (page: Page, origin: string) {
  yield* openSettings(page, origin);

  // Browser text at 200 percent doubles the root font size, and every rem with it.
  yield* Effect.promise(() =>
    page.addStyleTag({ content: "html { font-size: 200% !important; }" })
  );
  yield* Effect.promise(() =>
    page.evaluate(async () => {
      await document.fonts.ready;
    })
  );
  const rootSize = yield* Effect.promise(() =>
    page.evaluate(() => getComputedStyle(document.documentElement).fontSize)
  );
  const actions = yield* Effect.promise(() =>
    readFooterActions(actionsOf(page))
  );

  yield* Effect.sync(() => {
    expect(rootSize).toBe("32px");
    expect(Arr.map(actions, ({ label }) => label)).toEqual([
      app.Auth["delete-account"],
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
  });
});

const verifyActionOnOneLine = Effect.fn(
  "NakafaE2E.verifyDeleteActionOnOneLine"
)(function* (page: Page, origin: string) {
  yield* openSettings(page, origin);
  const actions = yield* Effect.promise(() =>
    readFooterActions(actionsOf(page))
  );
  const tops = yield* Effect.promise(() => labelTops(deleteAction(page)));

  yield* Effect.sync(() => {
    expect(Arr.map(actions, ({ label }) => label)).toEqual([
      app.Auth["delete-account"],
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
    // At the default text size the label keeps to one line.
    expect(Arr.dedupe(tops)).toHaveLength(1);
  });
});

test.describe("the account deletion card on the smallest phone", () => {
  test.use({
    viewport: { height: compactViewport.height, width: compactViewport.width },
  });

  test("keeps the delete action inside its card at 200% text", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      verifyActionAtLargeText(page, origin)
    );
  });

  test("keeps the delete label on one line at the default text size", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      verifyActionOnOneLine(page, origin)
    );
  });
});
