import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { saved } from "@/e2e/support/changes";
import { FAILED, RENAME, runOnPage } from "@/e2e/support/chat";
import {
  editorOf,
  headerControl,
  menuOf,
  NEW,
  OLD,
  openedChat,
  REFUSED,
  startRename,
  titleOf,
} from "@/e2e/support/rename";

/** The chat history panel's own toggle, at its foot beside the chat from 1280 px. */
const historyToggle = (page: Page) =>
  page
    .locator('[data-side="right"][data-slot="sidebar"]')
    .getByRole("button", { exact: true, name: "Chat history" });

/**
 * A rename saved with Enter while the server holds its answer. The focus goes
 * back to the control that opened the box at once, and stays there when the
 * answer comes.
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
      await expect(menuOf(page)).toBeFocused();
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
      const history = historyToggle(page);

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

/**
 * A refused rename brings the box back with the focus, unless a control the
 * learner chose while the rename was held has it: that control keeps it.
 */
const keepsFocusWhenRefused = Effect.fn(
  "NakafaE2E.renameKeepsFocusWhenRefused"
)(function* (page: Page, baseURL: string) {
  const { changes } = yield* openedChat(page, baseURL);

  yield* Effect.promise(async () => {
    const before = changes.sent;
    const history = historyToggle(page);

    changes.hold();
    changes.failNext(RENAME);
    await startRename(page);
    await page.keyboard.type(REFUSED);
    await page.keyboard.press("Enter");
    await expect(titleOf(page)).toHaveText(REFUSED);
    await history.click();
    changes.release();
    await expect(page.getByText(FAILED).first()).toBeVisible();
    await expect(editorOf(page)).toHaveValue(REFUSED);
    await expect(history).toBeFocused();
    await saved(changes, before);
  });
});

/**
 * While the learner renames the chat, the header's group keeps its two buttons,
 * the menu and the history, and the rename's two answers sit inside the box.
 */
const keepsTwoHeaderButtons = Effect.fn("NakafaE2E.renameKeepsTwoButtons")(
  function* (page: Page, baseURL: string) {
    yield* openedChat(page, baseURL);

    yield* Effect.promise(async () => {
      await startRename(page);
      const group = page
        .locator("main main header")
        .getByRole("group", { exact: true, name: "Chat actions" });
      await expect(
        group.getByRole("button").filter({ visible: true })
      ).toHaveCount(2);
      await expect(headerControl(page, "Cancel")).toBeVisible();
      await expect(headerControl(page, "Confirm")).toBeVisible();
    });
  }
);

test.describe("Chat rename focus at 1440px", () => {
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

  test("keeps two buttons in the header while the chat is renamed", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      keepsTwoHeaderButtons(page, origin)
    );
  });

  test("keeps the focus a learner chose when a refused rename brings the box back", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      keepsFocusWhenRefused(page, origin)
    );
  });
});
