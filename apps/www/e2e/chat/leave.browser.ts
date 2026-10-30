import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { composerOf } from "@/e2e/support/attachment";
import type { Changes } from "@/e2e/support/changes";
import {
  OPENED_CHAT,
  onThePage,
  openChatPage,
  runOnPage,
  START,
} from "@/e2e/support/chat";
import { sidebarRows } from "@/e2e/support/rows";
import {
  inTheSheet,
  openSheet,
  promptWith,
  UNCONFIRMED,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const PROMPT = "Why is the derivative of sine the cosine?";
/** A chat the learner already has, which the sidebar opens while the new chat is admitted. */
const OTHER = { prompt: "What is a limit?", title: "About limits" };
/** A chat the learner sends a follow-up in, while the sidebar leaves it for `OTHER`. */
const FIRST = {
  prompt: "What is the slope of a line?",
  title: "The slope of a line",
};
/** What the learner adds to a chat that has answered. */
const FOLLOW_UP = "And what about the tangent?";
const NOTICE = en.Toast["admitted-elsewhere"].title;
const OPEN = en.Common.open;

/**
 * Writes the prompt in the new chat and presses Enter. The server holds the
 * admission back, so the prompt shows as sent and nothing else has happened.
 */
const sendsAndWaits = Effect.fn("NakafaE2E.sendsAndWaits")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const composer = composerOf(onThePage(page));
    await composer.fill(PROMPT);
    await expect(
      onThePage(page).getByRole("button", { name: "Send message" })
    ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
    changes.hold();
    await composer.press("Enter");
    await expect(promptWith(onThePage(page), PROMPT)).toBeVisible();
  });
});

/**
 * The learner leaves the new chat for another chat of theirs, from the sidebar.
 * The server still holds its answers, so the other chat is only addressed, not
 * read: the test waits for the address, which the router changes at once.
 */
const leavesForOther = Effect.fn("NakafaE2E.leavesForOther")(function* (
  page: Page
) {
  yield* Effect.promise(async () => {
    await sidebarRows(page).filter({ hasText: OTHER.title }).click();
    await expect(page).toHaveURL(OPENED_CHAT, {
      timeout: readinessTimeoutMilliseconds,
    });
  });
  return page.url();
});

test.describe("A new chat admitted after the learner left, at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("tells the learner once that Nina answers in a new chat, without moving them, and opens it on request", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* learner.startChat(OTHER.prompt);
        yield* learner.titleNewest([OTHER.title]);
        yield* Effect.promise(() =>
          expect(
            sidebarRows(page).filter({ hasText: OTHER.title })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
        );

        yield* sendsAndWaits(page, changes);
        const left = yield* leavesForOther(page);
        changes.release();

        yield* Effect.promise(async () => {
          await expect(page.getByText(NOTICE)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(page.getByRole("button", { name: OPEN })).toBeVisible();
          expect(page.url()).toBe(left);
          await expect(page.getByText(NOTICE)).toHaveCount(1);
        });

        yield* Effect.promise(async () => {
          await page.getByRole("button", { name: OPEN }).click();
          await expect(page).toHaveURL(OPENED_CHAT, {
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(promptWith(onThePage(page), PROMPT)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    );
  });

  test("gives the learner's words back in the composer when the admission fails after they left", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* learner.startChat(OTHER.prompt);
        yield* learner.titleNewest([OTHER.title]);
        yield* Effect.promise(() =>
          expect(
            sidebarRows(page).filter({ hasText: OTHER.title })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
        );

        changes.failNext(START);
        yield* sendsAndWaits(page, changes);
        yield* leavesForOther(page);
        changes.release();

        yield* Effect.promise(async () => {
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(composerOf(onThePage(page))).toHaveValue(PROMPT);
        });
      })
    );
  });

  test("in the sheet, the notice opens the chat in the sheet after the learner closed it", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* learner.startChat(OTHER.prompt);
        yield* learner.titleNewest([OTHER.title]);

        yield* openSheet(page);
        const sheet = inTheSheet(page);
        yield* Effect.promise(async () => {
          const composer = composerOf(sheet);
          await composer.fill(PROMPT);
          await expect(
            sheet.getByRole("button", { name: "Send message" })
          ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
          changes.hold();
          await composer.press("Enter");
          await expect(promptWith(sheet, PROMPT)).toBeVisible();
          await sheet
            .getByRole("button", { exact: true, name: "Close" })
            .click();
          await expect(sheet).toBeHidden({
            timeout: readinessTimeoutMilliseconds,
          });
        });
        changes.release();

        yield* Effect.promise(async () => {
          await expect(page.getByText(NOTICE)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await page.getByRole("button", { name: OPEN }).click();
          await expect(inTheSheet(page)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(promptWith(inTheSheet(page), PROMPT)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    );
  });

  test("in the sheet, closing it while the chat is admitted leaves the notice and keeps the sheet closed", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* learner.startChat(OTHER.prompt);
        yield* learner.titleNewest([OTHER.title]);

        yield* openSheet(page);
        const sheet = inTheSheet(page);
        yield* Effect.promise(async () => {
          const composer = composerOf(sheet);
          await composer.fill(PROMPT);
          await expect(
            sheet.getByRole("button", { name: "Send message" })
          ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
          changes.hold();
          await composer.press("Enter");
          await expect(promptWith(sheet, PROMPT)).toBeVisible();
          await sheet
            .getByRole("button", { exact: true, name: "Close" })
            .click();
        });
        // The answer lands while the sheet is still sliding out of view.
        changes.release();

        yield* Effect.promise(async () => {
          await expect(page.getByText(NOTICE)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(sheet).toBeHidden({
            timeout: readinessTimeoutMilliseconds,
          });
          await page.getByRole("button", { name: OPEN }).click();
          await expect(inTheSheet(page)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(promptWith(inTheSheet(page), PROMPT)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    );
  });
});

test.describe("A follow-up admitted in a chat, which does not hold the next click, at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("a follow-up sent in a chat does not hold a click on another chat in the sidebar", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* learner.startChat(OTHER.prompt);
        yield* learner.startChat(FIRST.prompt);
        yield* learner.titleNewest([FIRST.title, OTHER.title]);
        yield* Effect.promise(() =>
          expect(
            sidebarRows(page).filter({ hasText: OTHER.title })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
        );

        yield* Effect.promise(async () => {
          await sidebarRows(page).filter({ hasText: FIRST.title }).click();
          await expect(page).toHaveURL(OPENED_CHAT, {
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(
            onThePage(page).getByRole("button", { name: "Send message" })
          ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
        });
        const first = page.url();

        yield* Effect.promise(async () => {
          const composer = composerOf(onThePage(page));
          await composer.fill(FOLLOW_UP);
          await expect(
            onThePage(page).getByRole("button", { name: "Send message" })
          ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
          changes.hold();
          await composer.press("Enter");
          await expect(promptWith(onThePage(page), FOLLOW_UP)).toBeVisible();
          await sidebarRows(page).filter({ hasText: OTHER.title }).click();
          // The follow-up is still admitted, and the click still moves the learner.
          await expect(page).not.toHaveURL(first, {
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(page).toHaveURL(OPENED_CHAT);
        });
        changes.release();
      })
    );
  });
});
