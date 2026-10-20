import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, String as Str } from "effect";
import { saved } from "../support/changes";
import {
  EMPTY,
  editorOf,
  memoryRow,
  opened,
  openMemoryPage,
} from "../support/memory";
import { withObservedPageErrors } from "../support/observe";
import { readinessTimeoutMilliseconds } from "../support/timeout";

const TITLE = "Study plan";
const WORDS = "Hello world";
const WIDE = { height: 900, width: 1440 };
const NARROW = { height: 900, width: 800 };
/** The editor puts what is typed within this long into one step of its undo history. */
const GROUP_MILLISECONDS = 600;

/** The title of a memory in its editor. */
const titleOf = (page: Page) =>
  page.getByRole("textbox", { exact: true, name: "Title" });

/** How many characters of the text come before the caret. */
const caretOf = (page: Page) =>
  page.evaluate(() => document.getSelection()?.anchorOffset ?? -1);

/**
 * Moves the window to `size`, across the width where the editor changes
 * between a panel and a sheet, and checks that the title, the words and the
 * caret are where the learner left them. Then the learner writes `typed` at
 * the caret.
 */
const acrossTheWidth = (
  page: Page,
  size: { height: number; width: number },
  words: string,
  typed: string
) =>
  Effect.promise(async () => {
    const editor = editorOf(page);
    const caret = await caretOf(page);

    await page.setViewportSize(size);
    await expect(editor).toHaveText(words);
    await expect(titleOf(page)).toHaveValue(TITLE);
    await expect(editor).toBeFocused();
    const after = `${Str.slice(0, caret)(words)}${typed}${Str.slice(caret)(words)}`;

    expect(await caretOf(page)).toBe(caret);
    await page.waitForTimeout(GROUP_MILLISECONDS);
    await page.keyboard.type(typed);
    await expect(editor).toHaveText(after);
    return after;
  });

/**
 * A new memory is being written when the window crosses the width where the
 * editor changes layout, in both directions. The editor is the same one on both
 * sides, so nothing the learner wrote is lost, the undo history keeps the steps
 * from before the change, and nothing is saved twice.
 */
const verifyLayoutChange = Effect.fn("NakafaE2E.verifyLayoutChange")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);
  const editor = editorOf(page);

  yield* Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    await titleOf(page).fill(TITLE);
    await editor.focus();

    // Two steps of history: the words, and what is written inside them.
    await page.keyboard.type(WORDS);
    await page.waitForTimeout(GROUP_MILLISECONDS);
    for (const key of Arr.makeBy("world".length, () => "ArrowLeft")) {
      await page.keyboard.press(key);
    }
    await page.keyboard.type("big ");
    await expect(editor).toHaveText("Hello big world");
  });
  yield* acrossTheWidth(page, NARROW, "Hello big world", "X");
  yield* Effect.promise(async () => {
    // The history holds the steps from before the change as well as the step after it.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).toHaveText("Hello big world");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).toHaveText(WORDS);
  });
  const written = yield* acrossTheWidth(page, WIDE, WORDS, "Y");
  yield* Effect.promise(async () => {
    const row = memoryRow(page, TITLE);

    // One memory, saved with what the learner wrote last.
    await editor.press("Escape");
    await expect(editor).toHaveCount(0);
    await expect(row).toHaveCount(1);
    await saved(changes, 0);
    await row.getByText(TITLE).click();
    await opened(page, written);
    await expect(titleOf(page)).toHaveValue(TITLE);
  });
});

test.describe("Memory editor across the width where it changes layout", () => {
  test.use({ viewport: WIDE });

  test("keeps the title, the words, the caret and the undo history", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyLayoutChange(page, origin))
        )
      )
    );
  });
});
