import { expect, type Page } from "@playwright/test";
import { Effect } from "effect";
import { trackChanges } from "@/e2e/support/changes";
import { declineUsageData, seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The Memory page of the English site. */
export const MEMORY_PATH = `${appRoutes.settings}/memory`;
const MEMORY_TITLE = /Memory/;
/**
 * The Convex name of `nina.memory.list`, the query that reads a page of the
 * list: the page subscribes to one for each page it loads. The refs module
 * cannot be imported here, because it pulls in packages that Node does not
 * resolve outside the bundler.
 */
export const LIST_QUERY = "nina/memory:list";
/** What the Memory page says when the learner has no memory. */
export const EMPTY = "No memories yet";
/** What the Memory page says when every memory is loaded and none matches the search. */
export const NO_RESULT = "No memory found";
/** What the Memory page says when a change names a memory that is gone. */
export const MISSING = "This memory no longer exists";
/** The title of the question that asks before one memory is deleted. */
const DELETE_TITLE = "Delete this memory?";
/** The button that confirms the delete which the question asks about. */
const DELETE_CONFIRM = "Delete memory";

/** One memory on the page, found by its title or its words. */
export const memoryRow = (page: Page, text: string) =>
  page.locator("main").getByRole("listitem").filter({ hasText: text });

/**
 * The question asked before one memory is deleted: a dialog on desktop and a
 * drawer on a phone, where the editor is a dialog too, so it is found by its title.
 */
export const deleteQuestion = (page: Page) =>
  page.getByRole("dialog").filter({
    has: page.getByRole("heading", { exact: true, name: DELETE_TITLE }),
  });

/** Confirms the delete that the question asks about. */
export const confirmDelete = (page: Page) =>
  deleteQuestion(page)
    .getByRole("button", { exact: true, name: DELETE_CONFIRM })
    .click();

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
  yield* declineUsageData(page, changes);
  return changes;
});

/** The name button of one memory's row, which opens the memory in the editor. */
export const nameOf = (page: Page, text: string) =>
  memoryRow(page, text).locator("button").first();

/** The editor on a wide screen: the panel beside the list. */
export const panelOf = (page: Page) =>
  page.getByRole("complementary", { name: "Edit memory" });

/** Runs one Memory flow in a browser, with the page's errors observed. */
export const runMemory = <E>(
  page: Page,
  baseURL: string | undefined,
  flow: (page: Page, origin: string) => Effect.Effect<void, E, never>
) =>
  Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.fromNullishOr(baseURL).pipe(
        Effect.flatMap((origin) => flow(page, origin))
      )
    )
  );
