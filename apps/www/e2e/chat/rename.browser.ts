import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { reloadUntil, saved } from "../support/changes";
import { FAILED, RENAME, runOnPage } from "../support/chat";
import {
  editorOf,
  NEW,
  OLD,
  openedChat,
  REFUSED,
  startRename,
  titleOf,
} from "../support/rename";

/** The longest title a chat takes, and what a learner who types more ends up with. */
const LONGEST = "x".repeat(80);

/** The new title shows in the header and in the sidebar before the server has answered anything. */
const showsAtOnce = Effect.fn("NakafaE2E.renameShowsAtOnce")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, row } = yield* openedChat(page, baseURL);

  yield* Effect.promise(async () => {
    const before = changes.sent;

    changes.hold();
    await startRename(page);
    await page.keyboard.type(NEW);
    await page.keyboard.press("Enter");
    await expect(titleOf(page)).toHaveText(NEW);
    await expect(row).toHaveText(NEW);
    changes.release();
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(titleOf(page)).toHaveText(NEW, { timeout: 3000 })
    );
  });
});

/** A learner who types more than 80 characters stops at 80, and the server takes them. */
const stopsAtTheLimit = Effect.fn("NakafaE2E.renameStopsAtTheLimit")(function* (
  page: Page,
  baseURL: string
) {
  const { changes } = yield* openedChat(page, baseURL);

  yield* Effect.promise(async () => {
    const before = changes.sent;

    await startRename(page);
    await page.keyboard.type("x".repeat(100));
    await expect(editorOf(page)).toHaveValue(LONGEST);
    await page.keyboard.press("Enter");
    await expect(titleOf(page)).toHaveText(LONGEST);
    await saved(changes, before);
    await expect(page.getByText(FAILED)).toHaveCount(0);
    await reloadUntil(page, () =>
      expect(titleOf(page)).toHaveText(LONGEST, { timeout: 3000 })
    );
  });
});

/**
 * A rename the server refuses: the old title comes back in the header and the
 * sidebar, the learner is told, and the box opens again with the words they
 * wrote and the caret in it.
 */
const givesBackWhenRefused = Effect.fn("NakafaE2E.renameGivesBackWhenRefused")(
  function* (page: Page, baseURL: string) {
    const { changes, row } = yield* openedChat(page, baseURL);

    yield* Effect.promise(async () => {
      const before = changes.sent;

      changes.hold();
      changes.failNext(RENAME);
      await startRename(page);
      await page.keyboard.type(REFUSED);
      await page.keyboard.press("Enter");
      await expect(titleOf(page)).toHaveText(REFUSED);
      await expect(row).toHaveText(REFUSED);
      changes.release();
      await expect(page.getByText(FAILED).first()).toBeVisible();
      await expect(row).toHaveText(OLD);
      await expect(editorOf(page)).toHaveValue(REFUSED);
      await expect(editorOf(page)).toBeFocused();
      // The box covers the title, and leaving it shows the title the chat still has.
      await page.keyboard.press("Escape");
      await expect(titleOf(page)).toHaveText(OLD);
      await saved(changes, before);
      await reloadUntil(page, () =>
        expect(titleOf(page)).toHaveText(OLD, { timeout: 3000 })
      );
    });
  }
);

test.describe("Chat rename at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("shows at once, in the header and in the sidebar", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => showsAtOnce(page, origin));
  });

  test("stops at 80 characters", async ({ baseURL, page }) => {
    await runOnPage(page, baseURL, (origin) => stopsAtTheLimit(page, origin));
  });

  test("gives the old title back when the server refuses", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      givesBackWhenRefused(page, origin)
    );
  });
});
