import { expect, type Page } from "@playwright/test";
import { Effect } from "effect";
import { live } from "./changes";
import { openChatPage } from "./chat";
import { readinessTimeoutMilliseconds } from "./timeout";

export const OLD = "Limits of sine";
export const NEW = "Derivatives of cosine";
export const REFUSED = "A title the server refuses";

/** The title in the header of a chat page. */
export const titleOf = (page: Page) =>
  page.locator("main main header").getByRole("heading", { level: 1 });

/** The box that renames the chat, which replaces the title while the learner edits it. */
export const editorOf = (page: Page) =>
  page.locator("main main header").getByRole("textbox");

/** Opens the box that renames the chat, from the chat's menu, with its words selected. */
export const startRename = async (page: Page) => {
  await page
    .locator("main main header")
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Rename chat" }).click();
  await expect(editorOf(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
};

/** A learner with one chat named `OLD`, open on its page with the sidebar beside it. */
export const openedChat = Effect.fn("NakafaE2E.openedChat")(function* (
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

/**
 * The control that opens the chat's menu. The box that renames the chat opens
 * from that menu, so it is the control the focus goes back to.
 */
export const menuOf = (page: Page) =>
  page
    .locator("main main header")
    .getByRole("button", { exact: true, name: "More actions" });

/** A header control of the chat, by its name. */
export const headerControl = (page: Page, name: string) =>
  page.locator("main main header").getByRole("button", { exact: true, name });
