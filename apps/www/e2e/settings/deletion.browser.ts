import { expect, type Locator, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readFooterActions, setLargeText } from "@/e2e/support/footer";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { compactViewport, touchViewport } from "@/e2e/support/viewport";

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

/** The icon inside the delete action, which a narrow footer hides. */
const deleteIcon = (page: Page) => deleteAction(page).locator("svg");

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

  const rootSize = yield* setLargeText(page);
  const actions = yield* Effect.promise(() =>
    readFooterActions(actionsOf(page))
  );
  const tops = yield* Effect.promise(() => labelTops(deleteAction(page)));
  const overflowWrap = yield* Effect.promise(() =>
    deleteAction(page).evaluate(
      (element) => getComputedStyle(element).overflowWrap
    )
  );
  yield* Effect.promise(async () => {
    await expect(deleteIcon(page)).toHaveCount(1);
    await expect(deleteIcon(page)).toBeHidden();
  });

  yield* Effect.sync(() => {
    expect(rootSize).toBe("32px");
    expect(Arr.map(actions, ({ label }) => label)).toEqual([
      app.Auth["delete-account"],
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
    // A narrow footer wraps the label between words, never inside a word.
    expect(overflowWrap).toBe("normal");
    expect(Arr.dedupe(tops).length).toBeLessThanOrEqual(2);
  });
});

const verifyActionWithIconAtDefaultText = Effect.fn(
  "NakafaE2E.verifyDeleteActionWithIconAtDefaultText"
)(function* (page: Page, origin: string) {
  yield* openSettings(page, origin);
  const actions = yield* Effect.promise(() =>
    readFooterActions(actionsOf(page))
  );
  const tops = yield* Effect.promise(() => labelTops(deleteAction(page)));
  const box = yield* Effect.promise(() => deleteAction(page).boundingBox());
  yield* Effect.promise(async () => {
    await expect(deleteIcon(page)).toHaveCount(1);
    await expect(deleteIcon(page)).toBeVisible();
  });

  yield* Effect.sync(() => {
    expect(Arr.map(actions, ({ label }) => label)).toEqual([
      app.Auth["delete-account"],
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
    expect(Arr.dedupe(tops)).toHaveLength(1);
    // The default size is h-9, which is 36 px at the default root font size.
    expect(box?.height).toBe(36);
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

  test("keeps the delete action inside its card at 200% text, in whole words", async ({
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

test.describe("the account deletion card on a standard phone", () => {
  test.use({
    viewport: { height: touchViewport.height, width: touchViewport.width },
  });

  test("shows the delete icon and a one-line label at the default text size", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      verifyActionWithIconAtDefaultText(page, origin)
    );
  });
});
