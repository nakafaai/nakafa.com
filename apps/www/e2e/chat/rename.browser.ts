import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { live, reloadUntil, saved } from "@/e2e/support/changes";
import { FAILED, openChatPage, RENAME, runOnPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const OLD = "Limits of sine";
const NEW = "Derivatives of cosine";
/** The longest title a chat takes, and what a learner who types more ends up with. */
const LONGEST = "x".repeat(80);
const REFUSED = "A title the server refuses";

/** The title in the header of a chat page. */
const titleOf = (page: Page) =>
  page.locator("main main header").getByRole("heading", { level: 1 });

/** The box that renames the chat, which replaces the title while the learner edits it. */
const editorOf = (page: Page) =>
  page.locator("main main header").getByRole("textbox");

/** Opens the box that renames the chat, from the chat's menu, with its words selected. */
const startRename = async (page: Page) => {
  await page
    .locator("main main header")
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Rename chat" }).click();
  await expect(editorOf(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
};

/** A learner with one chat named `OLD`, open on its page with the sidebar beside it. */
const openedChat = Effect.fn("NakafaE2E.openedChat")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, learner } = yield* openChatPage(page, baseURL);
  const chat = yield* learner.startChat("Rename me");
  yield* learner.titleNewest([OLD]);
  const row = page
    .locator(`a[data-sidebar="menu-button"][href$="/chat/${chat.chatId}"]`)
    .filter({ visible: true });

  yield* Effect.promise(async () => {
    await page.goto(`/en/chat/${chat.chatId}`);
    await expect(titleOf(page)).toHaveText(OLD, {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(row).toHaveText(OLD);
    await live(changes);
  });
  return { changes, row };
});

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
