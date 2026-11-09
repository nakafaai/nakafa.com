import { expect, type Locator, type Page } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { LESSON_PATH, openChatPage } from "@/e2e/support/chat";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The words of an empty composer, which also name its field. */
const PLACEHOLDER = app.Comments["add-comment-placeholder"];

/** The toggle of a closed thread, which names how many replies it holds. */
const REPLIES = /^\d+ repl(?:y|ies)$/u;

/** The row of one comment, found by its text. The row's container carries the comment's id. */
export function commentRow(page: Page, text: string) {
  return page
    .locator("div[id]")
    .filter({ has: page.getByText(text, { exact: true }) });
}

/** The field of the composer that is open last: a reply's when one is open, or the list's own. */
export function openComposer(page: Page) {
  return page.getByRole("textbox", { name: PLACEHOLDER }).last();
}

/** Writes words into the open composer's editor and sends them with its Send button. */
async function send(page: Page, field: Locator, text: string) {
  await field.fill(text);
  await page
    .getByRole("button", { name: app.Comments.send, exact: true })
    .last()
    .click();
  await expect(commentRow(page, text)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
}

/**
 * Brings the comments at the foot of the page into the window, so their feed mounts. It scrolls the footer
 * that holds them, which stays in the page, and not the comments' anchor, which React replaces while the
 * feed loads: a scroll that waits on a replaced element fails.
 */
export async function scrollToComments(page: Page) {
  await page.locator("footer:has(#comments)").scrollIntoViewIfNeeded();
}

/** Signs a learner in on one page and opens the lesson's comments there, with the feed mounted. */
export const openComments = Effect.fn("NakafaE2E.openComments")(function* (
  page: Page,
  baseURL: string
) {
  yield* withObservedPageErrors(page, openChatPage(page, baseURL));
  yield* Effect.promise(async () => {
    await page.goto(LESSON_PATH);
    await scrollToComments(page);
  });
});

/**
 * Opens the comments at the foot of the page, presses the closed composer of the list, and posts a
 * comment, waiting until its row shows.
 */
export async function postComment(page: Page, text: string) {
  await scrollToComments(page);
  await page
    .getByRole("button", { name: PLACEHOLDER, exact: true })
    .first()
    .click();
  await send(page, openComposer(page), text);
}

/** Replies to the comment whose row holds `answers`, from its Reply button, and waits for the reply's row. */
export async function replyToComment(
  page: Page,
  answers: string,
  text: string
) {
  await commentRow(page, answers)
    .getByRole("button", { name: app.Common.reply, exact: true })
    .first()
    .click();
  const field = openComposer(page);
  await expect(field).toBeFocused();
  await send(page, field, text);
}

/** The thread of the top-level comment whose row holds `text`: the comment, its toggle and its replies. */
export function commentThread(page: Page, text: string) {
  return page
    .locator('[data-slot="comment-thread"]')
    .filter({ has: page.getByText(text, { exact: true }) });
}

/** Opens the replies of the thread whose top-level row holds `text`, from the toggle that counts them. */
export async function openReplies(page: Page, text: string) {
  await commentThread(page, text)
    .getByRole("button", { name: REPLIES })
    .click();
}
