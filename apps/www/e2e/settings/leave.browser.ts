import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Clock, Effect } from "effect";
import { rewriteList } from "@/e2e/support/answer";
import { type Changes, live, reloadUntil, saved } from "@/e2e/support/changes";
import {
  confirmDelete,
  EMPTY,
  editorOf,
  MEMORY_PATH,
  MISSING,
  memoryRow,
  opened,
  openMemoryPage,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";
import { titleOf, widthOf, wordsShown, writeWorst } from "@/e2e/support/worst";

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
 * the editor. Nothing is written for the emptied draft, so the memory keeps the
 * words the server holds: only a confirmed delete removes it. A new memory that
 * was never given a word creates nothing, and a memory the learner empties and
 * then deletes from its row is deleted once, after the question.
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

    await waitUntilTakenOver(row.getByText(TITLE));
    await row.getByText(TITLE).click();
    await opened(page, WORDS);
    const before = changes.sent;

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await titleOf(page).fill("");
    await page.getByRole("button", { exact: true, name: "Close" }).click();

    await expect(editorOf(page)).toHaveCount(0);
    // The emptied draft is not written, so the row keeps the saved memory.
    await expect(row).toBeVisible();
    await page.waitForTimeout(1500);
    expect(changes.sent).toBe(before);
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
    await confirmDelete(page);
    await expect(editorOf(page)).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await saved(changes, once);
    await page.waitForTimeout(1500);
    expect(changes.sent - once).toBe(1);
    await expect(page.getByText(MISSING)).toHaveCount(0);
  });
});

test.describe("Memory editor closed on a memory the learner emptied", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("keeps the memory the learner emptied, and creates nothing for a memory with no word", async ({
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

/**
 * The learner types a first word and deletes the new memory while the server is
 * still storing it. Its row showed from the moment the save went out, so it is
 * deleted as a stored memory is, once the server has stored it and the learner
 * has confirmed the delete.
 */
const verifyFirstSave = Effect.fn("NakafaE2E.verifyFirstSave")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* startsEmpty(page, changes);
  yield* Effect.promise(async () => {
    const row = memoryRow(page, WORDS);

    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    changes.hold();
    const before = changes.sent;

    await page.keyboard.type(WORDS);
    // The first save goes out, the server's answer is held back, and the row
    // of the new memory shows meanwhile.
    await expect.poll(() => changes.sent).toBeGreaterThan(before);
    await expect(row).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Delete" }).click();
    const confirmed = changes.sent;
    await confirmDelete(page);
    await expect(editorOf(page)).toHaveCount(0);
    // The row leaves the list at once, while the server still holds its answer.
    await expect(row).toHaveCount(0);

    changes.release();
    await expect(page.getByText(EMPTY)).toBeVisible();
    // The delete goes out once the server has stored the memory. A reload drops
    // a change that is still on its way, so the page waits for the server's answer.
    await saved(changes, confirmed);
    await reloadUntil(page, () =>
      expect(page.getByText(EMPTY)).toBeVisible({ timeout: 3000 })
    );
  });
});

test.describe("Memory deleted while its first save is on its way", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("is deleted once the server stores it, after the learner confirms the delete", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyFirstSave(page, origin))
        )
      )
    );
  });
});

const NOTICE = en.Toast["memory-too-long"].title;

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
/** The one fact a situation's row says: when it ends. */
const ENDS = /^Ends \S.*\S$/;
/** The fact that says Nina saved a memory and when. */
const SAVED = /^Saved by Nina \S.* ago$/;
/** The one fact the row of a memory the learner wrote says. */
const WRITTEN = /^Written by you \S.* ago$/;

/** The facts line of a row. */
const factsOf = (page: Page, words: string) =>
  memoryRow(page, words).locator("span").nth(1);

/**
 * The backend holds a situation that ends in a week and one that ended two
 * days ago, which the daily job has not deleted. The page lists the first with
 * its end as the one fact of its row, and leaves the second out, as search and
 * the recall of a turn do. Opened, the first says its end and who saved it,
 * each on its own line that wraps.
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
    await expect(factsOf(page, FUTURE)).toHaveText(ENDS);
    await expect(factsOf(page, KEPT)).toHaveText(WRITTEN);
    // The line is one line cut at its end, and what is cut is not the end date.
    const line = factsOf(page, FUTURE);

    expect(
      await wordsShown(line, ENDS),
      `the line is ${await widthOf(line)}px wide`
    ).toBe(true);

    await memoryRow(page, FUTURE).getByText(FUTURE).click();
    await opened(page, FUTURE);
    const facts = page
      .locator("header")
      .filter({ has: titleOf(page) })
      .locator("p");

    await expect(facts).toHaveText([ENDS, SAVED]);
    // The facts of the open memory wrap and are not cut.
    expect(
      await facts.evaluateAll((lines) =>
        lines.every((line) => line.scrollWidth <= line.clientWidth)
      )
    ).toBe(true);
  });
});

for (const width of [320, 1440]) {
  test.describe(`Memory situations at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("lists the one that goes on by its end, and not the one that ended", async ({
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
