import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { writeMemory } from "@/e2e/support/list";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  EMPTY,
  editorOf,
  live,
  memoryRow,
  opened,
  openMemoryPage,
  reloadUntil,
  saved,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const KEPT = "Studies after dinner";
const MORE = " and on Sundays";
const ADDED = "Prefers short answers";
/** What the page tells the learner when a change fails. */
const FAILED = "We could not complete this action. Please try again.";
const MISSING = "This memory no longer exists";

/** Waits until the page shows an empty list and is signed in with its list live. */
const startsEmpty = (page: Page, changes: Changes) =>
  Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await live(changes);
  });

/**
 * The save of a stored memory fails as the learner closes its editor. The page
 * tells them and opens the editor again with the words they wrote last, though
 * the list went back to the stored words. Closing it sends the words again, and
 * this time the server takes them.
 */
const verifyFailedSave = Effect.fn("NakafaE2E.verifyFailedSave")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* startsEmpty(page, changes);
  yield* writeMemory(page, KEPT);
  yield* Effect.promise(async () => {
    const written = `${KEPT}${MORE}`;

    await saved(changes, 0);
    await memoryRow(page, KEPT).getByText(KEPT).click();
    await opened(page, KEPT);

    // The save the editor makes as it closes never reaches the server.
    const before = changes.sent;
    changes.failNext();
    await page.keyboard.type(MORE);
    await editorOf(page).press("Escape");
    await expect(page.getByText(FAILED).first()).toBeVisible();
    await opened(page, written);

    // Closing it again sends the words, and the server stores them.
    await editorOf(page).press("Escape");
    await expect(editorOf(page)).toHaveCount(0);
    await saved(changes, before);
    expect(changes.sent - before).toBe(2);
    await reloadUntil(page, () =>
      expect(memoryRow(page, written)).toBeVisible({ timeout: 3000 })
    );
  });
});

test.describe("Memory save that fails at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("opens the editor again with the latest words and sends them with the next close", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyFailedSave(page, origin))
        )
      )
    );
  });
});

/**
 * The learner deletes a memory and presses Undo, and the server cannot take the
 * memory back. The page tells them and opens the editor with the words of the
 * memory, as a new memory. Closing it stores them.
 */
const verifyFailedUndo = Effect.fn("NakafaE2E.verifyFailedUndo")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* startsEmpty(page, changes);
  yield* writeMemory(page, KEPT);
  yield* Effect.promise(async () => {
    const row = memoryRow(page, KEPT);

    await saved(changes, 0);
    const before = changes.sent;
    await row.hover();
    await row.getByRole("button", { name: "Delete memory" }).click();
    await expect(row).toHaveCount(0);
    await saved(changes, before);

    // The server cannot take the memory back, so its words open in the editor.
    changes.failNext();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(FAILED).first()).toBeVisible();
    await opened(page, KEPT);

    await editorOf(page).press("Escape");
    await expect(editorOf(page)).toHaveCount(0);
    await saved(changes, before);
    expect(changes.sent - before).toBe(3);
    await reloadUntil(page, () => expect(row).toBeVisible({ timeout: 3000 }));
  });
});

test.describe("Memory that cannot be brought back at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("opens its words in the editor, and closing it stores them", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyFailedUndo(page, origin))
        )
      )
    );
  });
});

/**
 * The learner deletes every memory while the first save of a new memory is on
 * its way. The server stores the memory and deletes it with the others, so the
 * editor closes when the server answers, nothing more is sent, and nothing
 * says the memory no longer exists.
 */
const verifyClearWhileAdding = Effect.fn("NakafaE2E.verifyClearWhileAdding")(
  function* (page: Page, baseURL: string) {
    const changes = yield* openMemoryPage(page, baseURL);

    yield* startsEmpty(page, changes);
    yield* Effect.promise(async () => {
      const before = changes.sent;

      await page.getByRole("button", { name: "Add memory" }).click();
      await opened(page, "");

      // The answers are held back: the first save stays on its way.
      changes.hold();
      await page.keyboard.type(ADDED);
      await expect
        .poll(() => changes.sent - before, { timeout: ANSWER_MILLISECONDS })
        .toBe(1);
      await expect(memoryRow(page, ADDED)).toBeVisible();
      await page
        .locator("main")
        .getByRole("button", { exact: true, name: "Delete all" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { exact: true, name: "Delete all" })
        .click();
      await expect(memoryRow(page, ADDED)).toHaveCount(0);

      changes.release();
      await expect(editorOf(page)).toHaveCount(0);
      await saved(changes, before);
      await page.waitForTimeout(1500);
      expect(changes.sent - before).toBe(2);
      await expect(page.getByText(MISSING)).toHaveCount(0);
      await reloadUntil(page, () =>
        expect(page.getByText(EMPTY)).toBeVisible({ timeout: 3000 })
      );
    });
  }
);

test.describe("Memory editor beside the list when everything is deleted at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("closes when the server answers the first save of a new memory that Delete all took", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyClearWhileAdding(page, origin))
        )
      )
    );
  });
});
