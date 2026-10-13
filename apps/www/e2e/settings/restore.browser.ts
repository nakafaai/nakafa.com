import { expect, type Page, test } from "@playwright/test";
import { Clock, Effect } from "effect";
import { changeRows } from "@/e2e/support/answer";
import { type Changes, live, reloadUntil, saved } from "@/e2e/support/changes";
import {
  EMPTY,
  LIST_QUERY,
  memoryRow,
  openMemoryPage,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { writeWorst } from "@/e2e/support/worst";

const TOAST = "[data-sonner-toast]";
const DAY = 86_400_000;
const NEWEST = "Studies after dinner";
const EXAM = "Exam on Friday";
const OLDEST = "Prefers worked examples";
/** The one fact a situation's row says: when it ends. */
const ENDS = /^Ends \S.*\S$/;
/** The functions the page calls to add a memory and to put one back. */
const ADD = "nina/memory:add";
const RESTORE = "nina/memory:restore";

/** The facts line of a row. */
const factsOf = (page: Page, words: string) =>
  memoryRow(page, words).locator("span").nth(1);

/** The rows of the list. */
const rowsOf = (page: Page) => page.locator("main ul > li");

/** Waits until the page shows an empty list and is signed in with its list live. */
const startsEmpty = (page: Page, changes: Changes) =>
  Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await live(changes);
  });

/**
 * The learner has three memories, and the one in the middle is a situation
 * that Nina saved and that ends in a week. They delete it and press Undo while
 * the server's answers are held back: the row is back at once, between the
 * other two and not first, with its end day, which only the page knows until
 * the server answers. The server then puts it back, and it is in the same
 * place after a reload. The Undo asks the server to put the memory back
 * (`restore`) and writes no new memory (`add`), which would put it first and
 * take its end day.
 *
 * The backend of a test holds no memory that ends, so the list it answers with
 * is changed to say that the memory with these words is such a situation. What
 * the server stores and gives back is proven by the backend tests; this proves
 * what the page does with it.
 */
const verifySituationUndo = Effect.fn("NakafaE2E.verifySituationUndo")(
  function* (page: Page, baseURL: string) {
    const changes = yield* openMemoryPage(page, baseURL);

    yield* startsEmpty(page, changes);
    yield* writeWorst(page, changes, { text: OLDEST });
    yield* writeWorst(page, changes, { text: EXAM });
    yield* writeWorst(page, changes, { text: NEWEST });
    const now = yield* Clock.currentTimeMillis;
    const endOfDay = (moment: number) =>
      Math.floor(moment / DAY) * DAY + DAY - 1;

    changes.rewrite(
      LIST_QUERY,
      changeRows((memory) =>
        typeof memory.text === "string" && memory.text.includes(EXAM)
          ? { ...memory, author: "nina", validUntil: endOfDay(now + 8 * DAY) }
          : memory
      )
    );
    yield* Effect.promise(async () => {
      const row = memoryRow(page, EXAM);
      const toast = page.locator(TOAST);

      // The list the backend answers with after a reload is the changed one.
      await page.reload();
      await live(changes);
      await expect(factsOf(page, EXAM)).toHaveText(ENDS);
      await expect(rowsOf(page).nth(1)).toContainText(EXAM);

      const added = changes.argumentsOf(ADD).length;
      const deleted = changes.sent;

      await row.hover();
      await row.getByRole("button", { name: "Delete memory" }).click();
      await expect(row).toHaveCount(0);
      await expect(toast.getByText("Memory deleted")).toBeVisible();
      await saved(changes, deleted);

      // The row is back before the server has answered, in the middle.
      const undone = changes.sent;

      changes.hold();
      await toast.getByRole("button", { name: "Undo" }).click();
      await expect(rowsOf(page).nth(1)).toContainText(EXAM);
      await expect(factsOf(page, EXAM)).toHaveText(ENDS);
      await expect(rowsOf(page)).toHaveCount(3);
      changes.release();
      await saved(changes, undone);

      expect(changes.argumentsOf(RESTORE)).toHaveLength(1);
      expect(changes.argumentsOf(ADD)).toHaveLength(added);
      await expect(page.getByText("This memory no longer exists")).toHaveCount(
        0
      );
      await expect(rowsOf(page).nth(1)).toContainText(EXAM);
      await expect(factsOf(page, EXAM)).toHaveText(ENDS);
      // The server stored the memory again, in the place it had.
      await reloadUntil(page, async () => {
        await expect(rowsOf(page).nth(1)).toContainText(EXAM, {
          timeout: 3000,
        });
        await expect(rowsOf(page)).toHaveCount(3);
      });
    });
  }
);

for (const width of [390, 1440]) {
  test.describe(`Memory deleted and put back at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("comes back at once, in its place, with the end day it had", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) => verifySituationUndo(page, origin))
          )
        )
      );
    });
  });
}

/**
 * The learner deletes a memory and keeps the pointer on its toast, which keeps
 * a toast open for as long as the pointer stays. The toast and its Undo still
 * end with the window in which the server keeps the memory, so the Undo is
 * never offered when it could only fail.
 */
const verifyUndoEnds = Effect.fn("NakafaE2E.verifyUndoEnds")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* startsEmpty(page, changes);
  yield* writeWorst(page, changes, { text: OLDEST });
  yield* Effect.promise(async () => {
    const row = memoryRow(page, OLDEST);
    const toast = page.locator(TOAST);
    const deleted = changes.sent;

    await row.hover();
    await row.getByRole("button", { name: "Delete memory" }).click();
    await saved(changes, deleted);
    await toast.hover();
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(toast).toBeHidden({ timeout: 10_000 });
    expect(changes.argumentsOf(RESTORE)).toHaveLength(0);
  });
});

test.describe("Memory deleted, with the pointer on its toast at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("ends the Undo with the window in which the server keeps the memory", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyUndoEnds(page, origin))
        )
      )
    );
  });
});
