import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { live, saved } from "@/e2e/support/changes";
import { writeMemory } from "@/e2e/support/list";
import {
  confirmDelete,
  deleteQuestion,
  EMPTY,
  memoryRow,
  openMemoryPage,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const FIRST = "Studies after dinner";
const SECOND = "Prefers short answers";
const THIRD = "Revises on Sundays";
const FOURTH = "Likes worked examples";

/**
 * A list shorter than a page keeps its rows while memories come and go around
 * them. One row is marked as an element of the page: a row that mounted again
 * would be a new element without the mark. Deleting another memory with the
 * keyboard leaves the mark, and the focus stays in the list, where the next
 * Tab goes on. Writing a new memory leaves it too.
 */
const verifyShortList = Effect.fn("NakafaE2E.verifyShortList")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);
  const marked = memoryRow(page, FIRST);
  const stillMarked = () =>
    marked.evaluate((element) => Reflect.get(element, "marked") === true);

  yield* Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await live(changes);
  });
  yield* writeMemory(page, FIRST);
  yield* writeMemory(page, SECOND);
  yield* writeMemory(page, THIRD);
  yield* Effect.promise(async () => {
    await saved(changes, 0);
    await marked.evaluate((element) => Reflect.set(element, "marked", true));

    const before = changes.sent;
    await memoryRow(page, SECOND)
      .getByRole("button", { name: "Delete memory" })
      .focus();
    await page.keyboard.press("Enter");
    const question = deleteQuestion(page);
    await expect(question).toBeVisible();
    await confirmDelete(page);
    await expect(memoryRow(page, SECOND)).toHaveCount(0);
    await saved(changes, before);
    expect(await stillMarked()).toBe(true);
    // Once the question has closed, the focus is back in the list.
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(document.activeElement?.closest("main ul")))
      )
      .toBe(true);
  });
  yield* writeMemory(page, FOURTH);
  yield* Effect.promise(async () => {
    await expect(memoryRow(page, FOURTH)).toBeVisible();
    expect(await stillMarked()).toBe(true);
    await expect(page.locator("main ul > li")).toHaveCount(3);
  });
});

for (const width of [390, 1440]) {
  test.describe(`Memory list shorter than a page at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("keeps its rows and the focus while memories are deleted and written", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) => verifyShortList(page, origin))
          )
        )
      );
    });
  });
}
