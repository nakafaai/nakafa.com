import { expect, type Locator, type Page } from "@playwright/test";
import { composerOf } from "./attachment";
import { OPENED_CHAT, onThePage } from "./chat";
import { promptWith } from "./sheet";
import { readinessTimeoutMilliseconds } from "./timeout";

/** The prompt the new chat tests send. */
export const PROMPT = "Why is the derivative of sine the cosine?";

/** The prompt a surface shows as a message: the composer holds the same words as text. */
export const promptIn = (scope: Locator) => promptWith(scope, PROMPT);

/** Writes the prompt, and waits until the surface knows who is signed in and lets it be sent. */
export const write = async (scope: Locator) => {
  await composerOf(scope).fill(PROMPT);
  await expect(scope.getByRole("button", { name: "Send message" })).toBeEnabled(
    { timeout: readinessTimeoutMilliseconds }
  );
};

/** Waits until the page of the chat that the new chat page moved to holds the prompt. */
export const pageOpensChat = (page: Page) => async () => {
  await expect(page).toHaveURL(OPENED_CHAT, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(promptIn(onThePage(page))).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
};
