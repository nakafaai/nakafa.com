import { expect, type Locator, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readFooterActions, setLargeText } from "@/e2e/support/footer";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  compactViewport,
  desktopViewport,
  touchViewport,
} from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The destructive card that holds the account deletion, the only one on the page. */
const deletionCard = (page: Page) =>
  page.locator('[data-slot="card"][data-variant="destructive"]');

/** The actions of the deletion card's footer, which hold the delete action. */
const actionsOf = (page: Page) =>
  deletionCard(page).locator('[data-slot="card-footer"] button');

/** The delete action, the footer's button named Delete account. */
const deleteAction = (page: Page) =>
  deletionCard(page).locator('[data-slot="card-footer"]').getByRole("button", {
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

/** Better Auth's delete route, which the dialog calls once the server prepared the account. */
const DELETE_USER = "**/api/auth/delete-user*";

/**
 * Records, until the page leaves, whether the deletion card left the page. The
 * page leaves by loading another document, which takes nothing off the page.
 */
async function watchDeletionCard(page: Page) {
  const record = { left: false };
  await page.exposeBinding("nakafaDeletionCardLeft", () => {
    record.left = true;
  });
  await page.evaluate(() => {
    const card = document.querySelector(
      '[data-slot="card"][data-variant="destructive"]'
    );
    new MutationObserver(() => {
      const left = Reflect.get(window, "nakafaDeletionCardLeft");
      if (card !== null && !card.isConnected && typeof left === "function") {
        left();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  return record;
}

/** Opens the deletion dialog and confirms the deletion in it. */
const confirmDeletion = (page: Page) =>
  Effect.promise(async () => {
    await waitUntilTakenOver(deleteAction(page));
    await deleteAction(page).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { exact: true, name: app.Auth["delete-account"] })
      .click();
  });

/**
 * Better Auth refuses the deletion after the server prepared the account, so
 * the server takes the preparation back. The account reads as gone in between,
 * and the page stays as it is: the dialog says why, and the profile and its
 * deletion card never leave the page.
 */
const verifyRefusedDeletion = Effect.fn("NakafaE2E.verifyRefusedDeletion")(
  function* (page: Page, origin: string) {
    yield* openSettings(page, origin);
    yield* Effect.promise(() =>
      page.route(DELETE_USER, (route) =>
        route.fulfill({
          json: {
            code: "ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE",
            message: "Refused by the test.",
          },
          status: 503,
        })
      )
    );
    const card = yield* Effect.promise(() => watchDeletionCard(page));
    yield* confirmDeletion(page);
    yield* Effect.promise(async () => {
      await expect(
        page.getByRole("dialog").getByText(app.Auth["delete-account-error"])
      ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
      await expect(deletionCard(page)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${appRoutes.settings}$`));
      expect(card.left).toBe(false);
    });
  }
);

/** How long a finished deletion may take to reach the home page: it prepares, deletes and checks on the server. */
const DELETION_MILLISECONDS = 60_000;

/**
 * The deletion goes through: the account reads as gone before the page leaves
 * for the home page, and the profile stays on the page until it does.
 */
const verifyDeletion = Effect.fn("NakafaE2E.verifyDeletion")(function* (
  page: Page,
  origin: string
) {
  yield* openSettings(page, origin);
  const card = yield* Effect.promise(() => watchDeletionCard(page));
  yield* confirmDeletion(page);
  yield* Effect.promise(async () => {
    await page.waitForURL((url) => url.pathname === "/en", {
      timeout: DELETION_MILLISECONDS,
      waitUntil: "load",
    });
    expect(card.left).toBe(false);
  });
});

test.describe("the account deletion flow on a desktop", () => {
  test.use({
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("keeps the page and says why when the deletion is refused after the account was prepared", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      verifyRefusedDeletion(page, origin)
    );
  });

  test("keeps the profile on the page until a finished deletion leaves for home", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => verifyDeletion(page, origin));
  });
});
