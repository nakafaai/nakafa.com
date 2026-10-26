import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { live, reloadUntil, saved } from "@/e2e/support/changes";
import { DELETE, FAILED, openChatPage, runOnPage } from "@/e2e/support/chat";
import { ACCESS_TITLE } from "@/e2e/support/share";
import {
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
} from "@/e2e/support/sheet";
import { shownTexts, watchTexts } from "@/e2e/support/shown";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The toast that says a chat on screen was deleted in another tab. */
const DELETED_ELSEWHERE = en.Toast["chat-deleted"].title;

/** A chat's row on the learner's chats page, which holds a link over the whole row. */
const rowOf = (page: Page, chatId: string) =>
  page.locator(`main main a[href="/en/chat/${chatId}"]`).locator("xpath=..");

/** A chat's row in the sidebar beside a chat page. */
const sidebarRowOf = (page: Page, chatId: string) =>
  page
    .locator(`a[data-sidebar="menu-button"][href$="/chat/${chatId}"]`)
    .filter({ visible: true });

/** Deletes a chat from the menu of its row on the chats page, and confirms in the dialog. */
const deleteFromRow = async (page: Page, chatId: string) => {
  await rowOf(page, chatId)
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm" })
    .click();
};

/** A learner with two chats, on their chats page. */
const onTheChatsPage = Effect.fn("NakafaE2E.onTheChatsPage")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, learner } = yield* openChatPage(page, baseURL);
  const oldest = yield* learner.startChat("The oldest");
  const newest = yield* learner.startChat("The newest");
  yield* learner.titleNewest(["Newest chat", "Oldest chat"]);

  yield* Effect.promise(async () => {
    await page.goto(`/en/@${learner.username}/chat`);
    await expect(rowOf(page, oldest.chatId)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await live(changes);
  });
  return { changes, newest, oldest };
});

/** A deleted chat leaves the chats page before the server answers, and stays away. */
const leavesAtOnce = Effect.fn("NakafaE2E.deleteLeavesAtOnce")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, newest, oldest } = yield* onTheChatsPage(page, baseURL);

  yield* Effect.promise(async () => {
    const before = changes.sent;

    changes.hold();
    await deleteFromRow(page, oldest.chatId);
    await expect(rowOf(page, oldest.chatId)).toHaveCount(0);
    changes.release();
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(rowOf(page, newest.chatId)).toBeVisible({ timeout: 3000 })
    );
    await expect(rowOf(page, oldest.chatId)).toHaveCount(0);
  });
});

/** A delete the server refuses brings the chat back to the chats page, and tells the learner. */
const comesBackWhenRefused = Effect.fn("NakafaE2E.deleteComesBackWhenRefused")(
  function* (page: Page, baseURL: string) {
    const { changes, oldest } = yield* onTheChatsPage(page, baseURL);

    yield* Effect.promise(async () => {
      const before = changes.sent;

      changes.hold();
      changes.failNext(DELETE);
      await deleteFromRow(page, oldest.chatId);
      await expect(rowOf(page, oldest.chatId)).toHaveCount(0);
      changes.release();
      await expect(page.getByText(FAILED).first()).toBeVisible();
      await expect(rowOf(page, oldest.chatId)).toContainText("Oldest chat");
      await saved(changes, before);
      await reloadUntil(page, () =>
        expect(rowOf(page, oldest.chatId)).toBeVisible({ timeout: 3000 })
      );
    });
  }
);

/**
 * Deleting from the chats page asks first. Closing the dialog keeps the chat in
 * its row, and no change reaches the server.
 */
const asksBeforeDeleting = Effect.fn("NakafaE2E.deleteAsksFirst")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, oldest } = yield* onTheChatsPage(page, baseURL);

  yield* Effect.promise(async () => {
    const before = changes.sent;

    await rowOf(page, oldest.chatId)
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(rowOf(page, oldest.chatId)).toContainText("Oldest chat");
    expect(changes.sent).toBe(before);
  });
});

/** The button that opens the menu of the open chat, which only its owner has. */
const chatMenuOf = (page: Page) =>
  page
    .locator("main main header")
    .getByRole("button", { name: "More actions" });

/** A learner with two chats, in the older one with the sidebar beside it. */
const inAnOpenChat = Effect.fn("NakafaE2E.inAnOpenChat")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, learner } = yield* openChatPage(page, baseURL);
  const oldest = yield* learner.startChat("The oldest");
  yield* learner.startChat("The newest");
  yield* learner.titleNewest(["Newest chat", "Oldest chat"]);

  yield* Effect.promise(async () => {
    await page.goto(`/en/chat/${oldest.chatId}`);
    await expect(sidebarRowOf(page, oldest.chatId)).toHaveText("Oldest chat", {
      timeout: readinessTimeoutMilliseconds,
    });
    // The menu appears once the page has read the chat and knows its owner.
    // A step that holds the server's answers back before then would never see it.
    await expect(chatMenuOf(page)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await live(changes);
  });

  /** Deletes the open chat from its menu, and confirms in the dialog. */
  const confirmDelete = () =>
    Effect.promise(async () => {
      await chatMenuOf(page).click();
      await page.getByRole("menuitem", { name: "Delete chat" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm" })
        .click();
    });
  return { changes, confirmDelete, learner, oldest };
});

/**
 * The learner deletes the chat they are in. Its row leaves the sidebar at once,
 * and they go to their chats once the server has deleted it. The chat is
 * theirs, so the page never says it is not, not even for the moment between
 * the server deleting it and the page moving on.
 */
const movesOnWhenDeleted = Effect.fn("NakafaE2E.deleteMovesOn")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, confirmDelete, learner, oldest } = yield* inAnOpenChat(
    page,
    baseURL
  );
  const before = changes.sent;

  yield* Effect.promise(() => watchTexts(page, [ACCESS_TITLE]));
  changes.hold();
  yield* confirmDelete();
  yield* Effect.promise(async () => {
    await expect(sidebarRowOf(page, oldest.chatId)).toHaveCount(0);
    changes.release();
    await expect(page).toHaveURL(new RegExp(`/en/@${learner.username}/chat$`), {
      timeout: readinessTimeoutMilliseconds,
    });
    await saved(changes, before);
    await expect(rowOf(page, oldest.chatId)).toHaveCount(0);
    expect(await shownTexts(page)).toEqual([]);
  });
});

/**
 * A delete the server refuses: the dialog is gone, the chat is back in the
 * sidebar, the learner is told, and they are still in the chat, which shows
 * its messages and its menu as before.
 */
const staysWhenRefused = Effect.fn("NakafaE2E.deleteStaysWhenRefused")(
  function* (page: Page, baseURL: string) {
    const { changes, confirmDelete, oldest } = yield* inAnOpenChat(
      page,
      baseURL
    );
    const before = changes.sent;

    changes.hold();
    changes.failNext(DELETE);
    yield* confirmDelete();
    yield* Effect.promise(async () => {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(sidebarRowOf(page, oldest.chatId)).toHaveCount(0);
      changes.release();
      await expect(page.getByText(FAILED).first()).toBeVisible();
      await expect(sidebarRowOf(page, oldest.chatId)).toHaveText("Oldest chat");
      await expect(page).toHaveURL(new RegExp(`/en/chat/${oldest.chatId}$`));
      await expect(chatMenuOf(page)).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect(
        page.locator('main main [data-slot="bubble"]').filter({
          hasText: "The oldest",
        })
      ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
      await saved(changes, before);
    });
  }
);

/**
 * Deletes a chat from the learner's chats page in a second tab of the same
 * browser, as the learner would in another tab or on another device.
 */
const deleteInAnotherTab = Effect.fn("NakafaE2E.deleteInAnotherTab")(function* (
  page: Page,
  username: string,
  chatId: string
) {
  const other = yield* Effect.promise(() => page.context().newPage());
  yield* Effect.promise(async () => {
    await other.goto(`/en/@${username}/chat`);
    const more = rowOf(other, chatId).getByRole("button", {
      name: "More actions",
    });
    await expect(more).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await waitUntilTakenOver(more);
    await deleteFromRow(other, chatId);
    await expect(rowOf(other, chatId)).toHaveCount(0);
  });
  return other;
});

/**
 * The learner deletes, in another tab, the chat this tab shows. This tab goes
 * to their chats and says why, and never shows the chat as one they may not
 * read.
 */
const leavesWhenDeletedElsewhere = Effect.fn(
  "NakafaE2E.deleteLeavesWhenDeletedElsewhere"
)(function* (page: Page, baseURL: string) {
  const { learner, oldest } = yield* inAnOpenChat(page, baseURL);

  yield* Effect.promise(() => watchTexts(page, [ACCESS_TITLE]));
  const other = yield* deleteInAnotherTab(
    page,
    learner.username,
    oldest.chatId
  );
  yield* Effect.promise(async () => {
    await expect(page).toHaveURL(new RegExp(`/en/@${learner.username}/chat$`), {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(page.getByText(DELETED_ELSEWHERE)).toBeVisible();
    await expect(rowOf(page, oldest.chatId)).toHaveCount(0);
    expect(await shownTexts(page)).toEqual([]);
    await other.close();
  });
});

/**
 * Nina's sheet shows a chat, and the learner deletes it in another tab. The
 * sheet lets it go and says why, and never shows it as a chat they may not
 * read.
 */
const sheetLetsGoWhenDeletedElsewhere = Effect.fn(
  "NakafaE2E.sheetLetsGoWhenDeletedElsewhere"
)(function* (page: Page, baseURL: string) {
  const { learner } = yield* openChatPage(page, baseURL);
  const gone = yield* learner.startChat("The chat that goes");
  yield* learner.startChat("The chat that stays");
  yield* learner.titleNewest(["Staying chat", "Going chat"]);
  yield* openSheet(page);
  yield* openFromHistory(page, "Going chat");
  yield* Effect.promise(async () => {
    await expect(
      promptWith(inTheSheet(page), "The chat that goes")
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await watchTexts(page, [ACCESS_TITLE]);
  });
  const other = yield* deleteInAnotherTab(page, learner.username, gone.chatId);
  yield* Effect.promise(async () => {
    await expect(page.getByText(DELETED_ELSEWHERE)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(
      promptWith(inTheSheet(page), "The chat that goes")
    ).toHaveCount(0);
    await expect(inTheSheet(page)).toBeVisible();
    expect(await shownTexts(page)).toEqual([]);
    await other.close();
  });
});

test.describe("Chat delete at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("leaves the chats page at once", async ({ baseURL, page }) => {
    await runOnPage(page, baseURL, (origin) => leavesAtOnce(page, origin));
  });

  test("comes back to the chats page when the server refuses", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      comesBackWhenRefused(page, origin)
    );
  });

  test("asks before it deletes from the chats page", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      asksBeforeDeleting(page, origin)
    );
  });

  test("leaves the sidebar at once from an open chat, and the learner moves on", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      movesOnWhenDeleted(page, origin)
    );
  });

  test("leaves for the chats when another tab deletes the open chat", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      leavesWhenDeletedElsewhere(page, origin)
    );
  });

  test("lets the sheet's chat go when another tab deletes it", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      sheetLetsGoWhenDeletedElsewhere(page, origin)
    );
  });

  test("stays in the sidebar and in the chat when the server refuses", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => staysWhenRefused(page, origin));
  });
});
