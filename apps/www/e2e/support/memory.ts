import { expect, type Page } from "@playwright/test";
import { Effect } from "effect";
import { trackChanges } from "@/e2e/support/changes";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The Memory page of the English site. */
export const MEMORY_PATH = "/en/user/settings/memory";
const MEMORY_TITLE = /Memory/;
/**
 * The Convex name of `nina.memory.list`, the query that reads a page of the
 * list: the page subscribes to one for each page it loads. The refs module
 * cannot be imported here, because it pulls in packages that Node does not
 * resolve outside the bundler.
 */
const LIST_QUERY = "nina/memory:list";

/** What the Memory page says when the learner has no memory. */
export const EMPTY = "No memories yet";
/** What the Memory page says when every memory is loaded and none matches the search. */
export const NO_RESULT = "No memory found";

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
 * Signs a synthetic learner in and opens the Memory page. It returns the
 * tracker of the changes the page sends from then on.
 */
export const openMemoryPage = Effect.fn("NakafaE2E.openMemoryPage")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* trackChanges(page, [LIST_QUERY]);
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
