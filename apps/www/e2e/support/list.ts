import { expect, type Page } from "@playwright/test";
import { Array as Arr, Effect, String as Str } from "effect";
import { MEMORY_PAGE } from "@/components/user/settings/memory/list";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  saved,
} from "@/e2e/support/changes";
import { EMPTY, editorOf, opened } from "@/e2e/support/memory";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How many memories the long list holds: three more than the first page loads. */
const MANY = MEMORY_PAGE + 3;
/** The memory written first, so it is the last on the list and waits on the second page. */
export const OLDEST = "Astronomy club studies the Kuiper belt";
/** A whole word of the oldest memory that no other memory holds. */
export const OLDEST_WORD = "kuiper";

/** The words of the nth memory after the oldest, numbered so that no two rows share a text. */
const topic = (number: number) =>
  `Revision topic ${Str.padStart(2, "0")(`${number}`)}`;
/** The memory written last, so it is the first on the list. */
export const NEWEST = topic(MANY - 1);
/** The memory written just before the newest, so it is the second on the list. */
export const SECOND_NEWEST = topic(MANY - 2);
/** The memory written just after the oldest, so it waits on the second page too. */
export const LATE = topic(1);
/**
 * The last memory of the first page, which is the last row the server renders:
 * the page holds `MEMORY_PAGE` memories, the newest first.
 */
export const LAST_SERVER = topic(MANY - MEMORY_PAGE);
/** The words of the long list, in the order they are written. */
const LONG_LIST = [
  OLDEST,
  ...Arr.makeBy(MANY - 1, (index) => topic(index + 1)),
];

/**
 * Writes one memory the way a learner does: Add, the words, and Escape, which
 * closes the editor and stores the words at once.
 */
export const writeMemory = Effect.fn("NakafaE2E.writeMemory")(function* (
  page: Page,
  text: string
) {
  yield* Effect.promise(async () => {
    const editor = editorOf(page);

    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    await page.keyboard.type(text);
    await editor.press("Escape");
    await expect(editor).toHaveCount(0);
  });
});

/**
 * Writes the long list one memory after another through the editor. Closing
 * the editor stores the words at once, so a memory never waits for the answer
 * to the one before it, and the step ends when the server has answered all of
 * them. The oldest is written first, so it ends up last on the list.
 *
 * The editor also saves after a pause in the writing, and a slow browser
 * pauses between two keys. Then a memory is added with the words written so
 * far, and its last words go out as a second change once the server answered
 * the add. So the step counts no changes: it waits until the server took a
 * change with the whole words of every memory, which is the last one of each.
 */
export const writeLongList = Effect.fn("NakafaE2E.writeLongList")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect
      .poll(() => changes.signedIn, { timeout: ANSWER_MILLISECONDS })
      .toBe(true);
  });

  const before = changes.sent;
  yield* Effect.forEach(LONG_LIST, (text) => writeMemory(page, text));
  yield* Effect.promise(async () => {
    await expect
      .poll(() => Arr.every(LONG_LIST, (text) => changes.took(text)), {
        timeout: ANSWER_MILLISECONDS,
      })
      .toBe(true);
    await saved(changes, before);
  });
});
