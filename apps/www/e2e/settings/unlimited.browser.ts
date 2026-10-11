import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, String as Str } from "effect";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  EMPTY,
  editorOf,
  memoryRow,
  opened,
  openMemoryPage,
  reloadUntil,
  saved,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const NO_RESULT = "No memory found";
/** How many memories the long list holds: more than the 30 that one page of the list loads. */
const MANY = 33;
/** The memory written first, so it is the last on the list and waits on the second page. */
const OLDEST = "Astronomy club studies the Kuiper belt";
/** A whole word of the oldest memory that no other memory holds. */
const OLDEST_WORD = "kuiper";
const OLDEST_REVISED = "Astronomy club moved to Mondays";

/** The words of the nth memory after the oldest, numbered so that no two rows share a text. */
const topic = (number: number) =>
  `Revision topic ${Str.padStart(2, "0")(`${number}`)}`;
/** The memory written last, so it is the first on the list. */
const NEWEST = topic(MANY - 1);
/** The words of the long list, in the order they are written. */
const LONG_LIST = [
  OLDEST,
  ...Arr.makeBy(MANY - 1, (index) => topic(index + 1)),
];

/**
 * Writes one memory the way a learner does: Add, the words, and Escape, which
 * closes the editor and stores the words at once.
 */
const writeMemory = Effect.fn("NakafaE2E.writeMemory")(function* (
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
 */
const writeLongList = Effect.fn("NakafaE2E.writeLongList")(function* (
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
      .poll(() => changes.sent - before, { timeout: ANSWER_MILLISECONDS })
      .toBe(MANY);
    await saved(changes, before);
  });
});

/**
 * After a reload only the first page of the list is loaded, so the oldest
 * memory is not on the page. Its word still finds it, because the server
 * reaches the pages the browser has not loaded, and the learner can open it
 * from the search. A search nothing matches says so, and clearing the search
 * brings the list back.
 */
const searchOldest = Effect.fn("NakafaE2E.searchOldest")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const oldest = memoryRow(page, OLDEST);
    const newest = memoryRow(page, NEWEST);
    const search = page.getByRole("searchbox", { name: "Search memories" });

    await expect(newest).toBeVisible();
    await expect(oldest).toHaveCount(0);

    // The page shows the search box before its code runs, and words typed in
    // that moment are lost, so the words are typed again until the server's
    // answer shows the memory.
    await expect
      .poll(() => changes.signedIn, { timeout: ANSWER_MILLISECONDS })
      .toBe(true);
    await expect(async () => {
      await search.fill(OLDEST_WORD);
      await expect(oldest).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: ANSWER_MILLISECONDS });
    await expect(newest).toHaveCount(0);

    // No loaded page holds the memory, and the editor still opens it.
    await oldest.getByText(OLDEST).click();
    await opened(page, OLDEST);
    await editorOf(page).press("Escape");
    await expect(editorOf(page)).toHaveCount(0);

    await search.fill("zzzzqq");
    await expect(page.getByText(NO_RESULT)).toBeVisible({
      timeout: ANSWER_MILLISECONDS,
    });
    await search.fill("");
    await expect(newest).toBeVisible();
    await expect(oldest).toHaveCount(0);
  });
});

/** The box the list scrolls in, found by the newest memory it holds. */
const listBox = (page: Page) =>
  page
    .locator('main [data-slot="scroll-area-viewport"]')
    .filter({ has: page.getByText(NEWEST) });

/**
 * The list scrolls inside its own box, and the next page loads when the end of
 * the list comes into view there. Scrolling the box to the bottom brings the
 * oldest memory in as the last row.
 */
const scrollToOldest = Effect.fn("NakafaE2E.scrollToOldest")(function* (
  page: Page
) {
  yield* Effect.promise(async () => {
    const box = listBox(page);
    const oldest = memoryRow(page, OLDEST);

    expect(
      await box.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);
    await expect(oldest).toHaveCount(0);

    await expect(async () => {
      await box.evaluate((element) =>
        element.scrollTo({ top: element.scrollHeight })
      );
      await expect(oldest).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: ANSWER_MILLISECONDS });
    await expect(box.getByRole("listitem").last()).toContainText(OLDEST);
  });
});

/**
 * Rewriting the oldest memory, which sits on the second page, moves it to the
 * top of the list at once and for good: it is still first after a reload.
 */
const reviseOldest = Effect.fn("NakafaE2E.reviseOldest")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const first = listBox(page).getByRole("listitem").first();
    const before = changes.sent;

    await memoryRow(page, OLDEST).getByText(OLDEST).click();
    await opened(page, OLDEST);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(OLDEST_REVISED);
    await editorOf(page).press("Escape");
    await expect(editorOf(page)).toHaveCount(0);
    await expect(first).toContainText(OLDEST_REVISED);
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(first).toContainText(OLDEST_REVISED, { timeout: 3000 })
    );
  });
});

/**
 * Signs a synthetic learner in and walks a list of more memories than one
 * page: it writes them, reloads so that one page is loaded, finds the oldest
 * by a word of it, scrolls the list to its end for the next page, and rewrites
 * the oldest from there.
 */
const verifyLongList = Effect.fn("NakafaE2E.verifyLongList")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* writeLongList(page, changes);
  yield* Effect.promise(() => page.reload());
  yield* searchOldest(page, changes);
  yield* scrollToOldest(page);
  yield* reviseOldest(page, changes);
});

for (const width of [390, 1440]) {
  test.describe(`Memory list at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("lists, searches and opens more memories than one page", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) => verifyLongList(page, origin))
          )
        )
      );
    });
  });
}
