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

/**
 * The control that opens the chat's menu. The box that renames the chat opens
 * from that menu, so it is the control the focus goes back to.
 */
const menuOf = (page: Page) =>
  page
    .locator("main main header")
    .getByRole("button", { exact: true, name: "More actions" });

/** A header control of the chat, by its name. */
const headerControl = (page: Page, name: string) =>
  page.locator("main main header").getByRole("button", { exact: true, name });

/**
 * A rename saved with Enter while the server holds its answer. The control that
 * opened the box is disabled until the answer comes, and the focus goes back to
 * it once the answer has come.
 */
const returnsFocusWhenSaved = Effect.fn("NakafaE2E.renameReturnsFocus")(
  function* (page: Page, baseURL: string) {
    const { changes } = yield* openedChat(page, baseURL);

    yield* Effect.promise(async () => {
      const before = changes.sent;

      changes.hold();
      await startRename(page);
      await page.keyboard.type(NEW);
      await page.keyboard.press("Enter");
      await expect(titleOf(page)).toHaveText(NEW);
      await expect(menuOf(page)).toBeDisabled();
      changes.release();
      await saved(changes, before);
      await expect(menuOf(page)).toBeFocused();
    });
  }
);

/** Escape closes the box without a change, and the focus goes back to the chat's menu. */
const returnsFocusOnEscape = Effect.fn("NakafaE2E.renameEscapeReturnsFocus")(
  function* (page: Page, baseURL: string) {
    yield* openedChat(page, baseURL);

    yield* Effect.promise(async () => {
      await startRename(page);
      await page.keyboard.press("Escape");
      await expect(titleOf(page)).toHaveText(OLD);
      await expect(menuOf(page)).toBeFocused();
    });
  }
);

/** Cancel closes the box without a change, and the focus goes back to the chat's menu. */
const returnsFocusOnCancel = Effect.fn("NakafaE2E.renameCancelReturnsFocus")(
  function* (page: Page, baseURL: string) {
    yield* openedChat(page, baseURL);

    yield* Effect.promise(async () => {
      await startRename(page);
      await headerControl(page, "Cancel").click();
      await expect(titleOf(page)).toHaveText(OLD);
      await expect(menuOf(page)).toBeFocused();
    });
  }
);

/** Confirm saves the title, and the focus goes back to the chat's menu once the answer has come. */
const returnsFocusOnConfirm = Effect.fn("NakafaE2E.renameConfirmReturnsFocus")(
  function* (page: Page, baseURL: string) {
    const { changes } = yield* openedChat(page, baseURL);

    yield* Effect.promise(async () => {
      const before = changes.sent;

      changes.hold();
      await startRename(page);
      await page.keyboard.type(NEW);
      await headerControl(page, "Confirm").click();
      await expect(titleOf(page)).toHaveText(NEW);
      changes.release();
      await saved(changes, before);
      await expect(menuOf(page)).toBeFocused();
    });
  }
);

/**
 * A control the learner chooses while the rename is held keeps the focus: the
 * focus only goes back to the chat's menu when nothing else has the focus.
 */
const keepsFocusTheLearnerChose = Effect.fn("NakafaE2E.renameKeepsFocus")(
  function* (page: Page, baseURL: string) {
    const { changes } = yield* openedChat(page, baseURL);

    yield* Effect.promise(async () => {
      const before = changes.sent;
      const history = headerControl(page, "Chat history");

      changes.hold();
      await startRename(page);
      await page.keyboard.type(NEW);
      await page.keyboard.press("Enter");
      await expect(titleOf(page)).toHaveText(NEW);
      await history.click();
      changes.release();
      await saved(changes, before);
      await expect(history).toBeFocused();
    });
  }
);

test.describe("Chat rename at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("returns the focus to the chat's menu once a held rename is saved", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      returnsFocusWhenSaved(page, origin)
    );
  });

  test("returns the focus to the chat's menu when Escape closes the box", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      returnsFocusOnEscape(page, origin)
    );
  });

  test("returns the focus to the chat's menu when Cancel closes the box", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      returnsFocusOnCancel(page, origin)
    );
  });

  test("returns the focus to the chat's menu once Confirm is saved", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      returnsFocusOnConfirm(page, origin)
    );
  });

  test("keeps the focus a learner moved to while the rename is held", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      keepsFocusTheLearnerChose(page, origin)
    );
  });

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
