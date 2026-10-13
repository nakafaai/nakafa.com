import type { Locator, Page } from "@playwright/test";
import { Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { BUBBLE, SHEET_POPUP } from "@/e2e/support/selector";

/** What the pages tell the learner when a prompt could not be confirmed. */
export const UNCONFIRMED =
  "We could not confirm the request. Check your connection and try again.";
/** What a chat says when Nina's answer failed, which the local backend cannot avoid. */
export const UNAVAILABLE =
  "Nina cannot access the AI service right now. Please try again later. If this continues, contact Nakafa support.";

/** The box where the learner writes to Nina, inside a surface. */
export const composerOf = (scope: Locator) =>
  scope.getByRole("textbox", { name: "Ask Nina anything..." });

/**
 * The prompt with these words, which a surface shows as a message. Only a
 * bubble a reader can see counts. Next.js keeps the surface a learner left in
 * the same document, hidden, and it holds the prompt it showed until React
 * renders it again, so a locator that counted hidden bubbles would find the
 * prompt twice for a moment after a chat opens. One match per prompt is also
 * what a reader sees: a second visible copy makes the assertion fail.
 */
export const promptWith = (scope: Locator, text: string) =>
  scope.locator(BUBBLE).filter({ hasText: text, visible: true });

/** Nina's sheet on a lesson, where an admitted prompt opens its chat inside the sheet. */
export const inTheSheet = (page: Page) => page.locator(SHEET_POPUP);

/** Opens the sheet on a lesson, once the learner is signed in. */
export const openSheet = (page: Page) =>
  Effect.promise(async () => {
    await page.goto(LESSON_PATH);
    await page.getByRole("button", { exact: true, name: "Ask Nina" }).click();
  });

/** Opens a chat of the learner in the sheet, from its history of recent chats. */
export const openFromHistory = (page: Page, title: string) =>
  Effect.promise(async () => {
    await page.getByRole("button", { name: "Chat history" }).click();
    await page.getByRole("menuitem", { name: title }).click();
  });
