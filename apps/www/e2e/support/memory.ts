import { expect, type Page } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const MEMORY_PATH = "/en/user/settings/memory";
const MEMORY_TITLE = /Memory/;

/** What the Memory page says when the learner has no memory. */
export const EMPTY = "No memories yet";
/** How long a step waits for the server to answer a change. */
export const ANSWER_MILLISECONDS = 15_000;

/** One memory on the page, found by its title or its words. */
export const memoryRow = (page: Page, text: string) =>
  page.locator("main").getByRole("listitem").filter({ hasText: text });

/** The text of a memory in its editor. The editor's code loads when the learner opens it. */
export const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "Memory text" });

/**
 * Waits for an editor that just opened to hold `text` and the caret. The
 * editor takes the focus a moment after it appears, so a press before that
 * would land in the text instead of where it aimed.
 */
export const opened = async (page: Page, text: string) => {
  const editor = editorOf(page);
  await expect(editor).toHaveText(text, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(editor).toBeFocused();
};

/**
 * Counts the changes the page sent and the ones the server answered, and
 * knows whether the page's connection has signed in. The page shows a change
 * before the server has it, and a reload closes the connection and drops a
 * change that is still on its way, so a step that reloads waits for the answer
 * first. A reload also opens a connection that signs in a moment after the
 * page shows, and a change pressed before that is refused.
 */
const trackChanges = (page: Page) => {
  const changes = { answered: 0, sent: 0, signedIn: false };
  // A reload ends the connection that had signed in, before the next one opens.
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      changes.signedIn = false;
    }
  });
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      if (String(payload).includes('"type":"Authenticate"')) {
        changes.signedIn = true;
      }
      if (String(payload).includes('"type":"Mutation"')) {
        changes.sent += 1;
      }
    });
    socket.on("framereceived", ({ payload }) => {
      if (String(payload).includes('"type":"MutationResponse"')) {
        changes.answered += 1;
      }
    });
  });
  return changes;
};

export type Changes = ReturnType<typeof trackChanges>;

/** Waits until the page sent a change after `sentBefore` and the server answered every change. */
export const saved = (changes: Changes, sentBefore: number) =>
  expect
    .poll(
      () => changes.sent > sentBefore && changes.answered === changes.sent,
      { timeout: ANSWER_MILLISECONDS }
    )
    .toBe(true);

/** Repeats a reload until the server shows what the learner changed. */
export const reloadUntil = (page: Page, check: () => Promise<void>) =>
  expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 20_000 });

/**
 * Signs a synthetic learner in and opens the Memory page. It returns the count
 * of the changes the page sends from then on.
 */
export const openMemoryPage = Effect.fn("NakafaE2E.openMemoryPage")(function* (
  page: Page,
  baseURL: string
) {
  const changes = trackChanges(page);
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* Effect.promise(() => page.goto(MEMORY_PATH));
  yield* Effect.promise(() => expect(page).toHaveTitle(MEMORY_TITLE));

  // A signed-in learner decides analytics once for the account.
  const decline = page.getByRole("button", { exact: true, name: "Decline" });
  yield* activate(decline, false);
  yield* Effect.promise(() =>
    expect(decline).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );
  return changes;
});
