import { expect, type Page, test } from "@playwright/test";
import { Clock, Effect } from "effect";
import { rewriteList } from "@/e2e/support/frames";
import {
  type Changes,
  EMPTY,
  editorOf,
  live,
  MEMORY_PATH,
  memoryRow,
  opened,
  openMemoryPage,
  reloadUntil,
  saved,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { titleOf, wordsShown, writeWorst } from "@/e2e/support/worst";

const TITLE = "Study habits";
const WORDS = "Studies after dinner";
const TOAST = "[data-sonner-toast]";
const DAY = 86_400_000;

/** Waits until the page shows an empty list and is signed in with its list live. */
const startsEmpty = (page: Page, changes: Changes) =>
  Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await live(changes);
  });

/**
 * The learner removes every word and the title of a stored memory and closes
 * the editor. The memory goes as the Delete button sends it, with the same
 * toast and its Undo, which brings the words and the title back. A new memory
 * that was never given a word creates nothing, and a memory the learner emptied
 * and then deleted from its row is deleted once.
 */
const verifyEmptied = Effect.fn("NakafaE2E.verifyEmptied")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* startsEmpty(page, changes);
  yield* writeWorst(page, changes, { text: WORDS, title: TITLE });
  yield* Effect.promise(async () => {
    const row = memoryRow(page, TITLE);
    const toast = page.locator(TOAST);

    await row.getByText(TITLE).click();
    await opened(page, WORDS);
    const before = changes.sent;

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await titleOf(page).fill("");
    await page.getByRole("button", { exact: true, name: "Close" }).click();

    await expect(editorOf(page)).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(toast.getByText("Memory deleted")).toBeVisible();
    await saved(changes, before);

    const undone = changes.sent;

    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(row).toBeVisible();
    await saved(changes, undone);
    await reloadUntil(page, () => expect(row).toBeVisible({ timeout: 3000 }));

    // A new memory that was never given a word is never stored.
    const sent = changes.sent;

    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    await editorOf(page).press("Escape");
    await expect(editorOf(page)).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(changes.sent).toBe(sent);
    await expect(page.locator("main ul > li")).toHaveCount(1);

    // The learner removes every word and deletes the memory from its row while
    // the editor is open. The row's deletion closes the editor, and the editor,
    // closing on no words, does not delete the memory a second time.
    await row.getByText(TITLE).click();
    await opened(page, WORDS);
    const once = changes.sent;

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await titleOf(page).fill("");
    await row.hover();
    await row.getByRole("button", { name: "Delete memory" }).click();
    await expect(editorOf(page)).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await saved(changes, once);
    await page.waitForTimeout(1500);
    expect(changes.sent - once).toBe(1);
    await expect(toast.getByText("Memory deleted")).toHaveCount(1);
    await expect(page.getByText("This memory no longer exists")).toHaveCount(0);
  });
});

test.describe("Memory editor closed on a memory the learner emptied", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("deletes the memory with an Undo, and creates nothing for a memory with no word", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyEmptied(page, origin))
        )
      )
    );
  });
});

const NOTICE = "That text is too long for one memory";

/**
 * A paste that fits goes in. A paste that does not fit is refused as a whole
 * and the learner is told, and the count stays the count of the stored text.
 */
const verifyPaste = Effect.fn("NakafaE2E.verifyPaste")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* startsEmpty(page, changes);
  yield* Effect.promise(async () => {
    const copy = (text: string) =>
      page.evaluate((words) => navigator.clipboard.writeText(words), text);

    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    await page.keyboard.insertText("x".repeat(1990));
    await expect(page.getByText("1,990 / 2,000")).toBeVisible();

    // The clipboard reaches the editor: a paste that fits is inserted.
    await copy("zz");
    await page.keyboard.press("ControlOrMeta+v");
    await expect(page.getByText("1,992 / 2,000")).toBeVisible();
    await expect(page.locator(TOAST)).toHaveCount(0);

    // A paste that passes the limit is refused with a message.
    await copy("y".repeat(2500));
    await page.keyboard.press("ControlOrMeta+v");
    await expect(page.locator(TOAST).getByText(NOTICE)).toBeVisible();
    await expect(page.getByText("1,992 / 2,000")).toBeVisible();
  });
});

test.describe("Memory editor with a paste that does not fit", () => {
  test.use({
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { height: 900, width: 1440 },
  });

  test("tells the learner why nothing was inserted", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyPaste(page, origin))
        )
      )
    );
  });
});

const FUTURE = "Studies after dinner";
const ENDED = "Exam on Friday";
const KEPT = "Prefers worked examples";
/** What the facts line of a situation starts with: when it ends. */
const ENDS_FIRST = /^Ends .+ · Saved by Nina · .+$/;
/** What the facts line of a memory the learner wrote starts with. */
const WRITTEN_FIRST = /^Written by you · .+$/;
/** The words of a facts line that say when a situation ends. */
const ENDS_WORDS = /Ends [^·]*[^·\s]/;

/** The facts line of a row. */
const factsOf = (page: Page, words: string) =>
  memoryRow(page, words).locator("span").nth(1);

/**
 * The backend holds a situation that ends in a week and one that ended two
 * days ago, which the daily job has not deleted. The page lists the first with
 * the end said first in its facts line, and leaves the second out, as search and
 * a turn's start do. Opened, the first says all its facts on lines that wrap.
 */
const verifySituations = Effect.fn("NakafaE2E.verifySituations")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* startsEmpty(page, changes);
  yield* writeWorst(page, changes, { text: KEPT });
  yield* writeWorst(page, changes, { text: ENDED });
  yield* writeWorst(page, changes, { text: FUTURE });
  const now = yield* Clock.currentTimeMillis;
  const endOfDay = (moment: number) => Math.floor(moment / DAY) * DAY + DAY - 1;

  yield* rewriteList(page, (memory, index) => {
    if (index === 0) {
      return {
        ...memory,
        author: "nina",
        validUntil: endOfDay(now + 8 * DAY),
      };
    }
    return index === 1
      ? { ...memory, author: "nina", validUntil: endOfDay(now - 2 * DAY) }
      : memory;
  });
  yield* Effect.promise(async () => {
    await page.goto(MEMORY_PATH);

    // The list the backend answers with replaces the server's first page.
    await expect(memoryRow(page, ENDED)).toHaveCount(0);
    await expect(memoryRow(page, KEPT)).toBeVisible();
    await expect(memoryRow(page, FUTURE)).toBeVisible();
    await expect(factsOf(page, FUTURE)).toHaveText(ENDS_FIRST);
    await expect(factsOf(page, KEPT)).toHaveText(WRITTEN_FIRST);
    // The line is one line cut at its end, and what is cut is not the end date.
    expect(await wordsShown(factsOf(page, FUTURE), ENDS_WORDS)).toBe(true);

    await memoryRow(page, FUTURE).getByText(FUTURE).click();
    await opened(page, FUTURE);
    const facts = page
      .locator("header")
      .filter({ has: titleOf(page) })
      .locator("p");

    await expect(facts).toHaveText(ENDS_FIRST);
    // The facts of the open memory wrap and are not cut.
    expect(
      await facts.evaluate((line) => line.scrollWidth <= line.clientWidth)
    ).toBe(true);
  });
});

for (const width of [320, 1440]) {
  test.describe(`Memory situations at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("lists the one that goes on with its end first, and not the one that ended", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) => verifySituations(page, origin))
          )
        )
      );
    });
  });
}
