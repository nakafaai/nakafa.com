import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { type Changes, live, reloadUntil, saved } from "@/e2e/support/changes";
import { writeMemory } from "@/e2e/support/list";
import {
  confirmDelete,
  EMPTY,
  editorOf,
  MISSING,
  memoryRow,
  opened,
  openMemoryPage,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const ADDED = "Prefers short answers";
const REWRITTEN = "Prefers a long walk through each step";
const KEPT = "Studies after dinner";

/**
 * Runs `act` while the server's answers are held back, checks what the page
 * shows on its own with `expectation`, then lets the answers through and waits
 * until the server has answered every change. A change that only shows once
 * the server answers cannot pass this: nothing the server says reaches the
 * page in between.
 */
const beforeTheAnswer = Effect.fn("NakafaE2E.beforeTheAnswer")(function* (
  changes: Changes,
  act: Effect.Effect<void>,
  expectation: () => Promise<void>
) {
  const before = changes.sent;

  changes.hold();
  yield* act;
  yield* Effect.promise(expectation);
  changes.release();
  yield* Effect.promise(() => saved(changes, before));
});

/** A new memory shows in the list when the editor closes. */
const addsBeforeTheAnswer = (page: Page, changes: Changes) =>
  beforeTheAnswer(changes, writeMemory(page, ADDED), async () => {
    await expect(memoryRow(page, ADDED)).toBeVisible();
    await expect(page.getByText(EMPTY)).toBeHidden();
  });

/** Rewritten words show in the list, in the memory's row, when the editor closes. */
const editsBeforeTheAnswer = (page: Page, changes: Changes) =>
  beforeTheAnswer(
    changes,
    Effect.promise(async () => {
      await memoryRow(page, ADDED).getByText(ADDED).click();
      await opened(page, ADDED);
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type(REWRITTEN);
      await editorOf(page).press("Escape");
      await expect(editorOf(page)).toHaveCount(0);
    }),
    async () => {
      await expect(memoryRow(page, REWRITTEN)).toBeVisible();
      await expect(memoryRow(page, ADDED)).toHaveCount(0);
    }
  );

/** A memory the learner confirms the deletion of leaves the list at once. */
const removesBeforeTheAnswer = (page: Page, changes: Changes) =>
  beforeTheAnswer(
    changes,
    Effect.promise(async () => {
      const row = memoryRow(page, REWRITTEN);

      await row.hover();
      await row.getByRole("button", { name: "Delete memory" }).click();
      await confirmDelete(page);
    }),
    async () => {
      await expect(memoryRow(page, REWRITTEN)).toHaveCount(0);
      await expect(page.getByText(EMPTY)).toBeVisible();
    }
  );

/** Deleting everything empties the list at once, and it stays empty after a reload. */
const clearsBeforeTheAnswer = (page: Page, changes: Changes) =>
  beforeTheAnswer(
    changes,
    Effect.promise(async () => {
      await page
        .locator("main")
        .getByRole("button", { exact: true, name: "Delete all" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { exact: true, name: "Delete all" })
        .click();
    }),
    async () => {
      await expect(memoryRow(page, KEPT)).toHaveCount(0);
      await expect(page.getByText(EMPTY)).toBeVisible();
    }
  );

/**
 * Every change shows before the server answers it: adding, rewriting and
 * deleting a memory, and deleting all of them.
 */
const verifyOptimisticChanges = Effect.fn("NakafaE2E.verifyChanges")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* Effect.promise(() =>
    expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() => live(changes));
  yield* addsBeforeTheAnswer(page, changes);
  yield* editsBeforeTheAnswer(page, changes);
  yield* removesBeforeTheAnswer(page, changes);
  // Two memories, so that deleting all of them takes more than the one.
  yield* writeMemory(page, KEPT);
  yield* writeMemory(page, ADDED);
  yield* Effect.promise(() => saved(changes, 0));
  yield* clearsBeforeTheAnswer(page, changes);
  yield* Effect.promise(() =>
    reloadUntil(page, () =>
      expect(page.getByText(EMPTY)).toBeVisible({ timeout: 3000 })
    )
  );
});

test.describe("Memory changes at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("show before the server answers", async ({ baseURL, page }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyOptimisticChanges(page, origin))
        )
      )
    );
  });
});

/**
 * With the editor open beside the list, the learner writes a letter and
 * deletes the memory from its row before the editor has saved it. The editor
 * closes, the deletion is the only change sent, and nothing says the memory no
 * longer exists. The letter the editor had not saved is never written.
 */
const verifyRowDeleteWithEditor = Effect.fn("NakafaE2E.verifyRowDelete")(
  function* (page: Page, baseURL: string) {
    const changes = yield* openMemoryPage(page, baseURL);

    yield* Effect.promise(() =>
      expect(page.getByText(EMPTY)).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      })
    );
    yield* Effect.promise(() => live(changes));
    yield* writeMemory(page, KEPT);
    yield* Effect.promise(async () => {
      const row = memoryRow(page, KEPT);

      await saved(changes, 0);
      await row.getByText(KEPT).click();
      await opened(page, KEPT);

      // The pointer stays on the row, so the delete is one press away.
      const before = changes.sent;
      const remove = row.getByRole("button", { name: "Delete memory" });
      await page.keyboard.type("!");
      await remove.click();
      await confirmDelete(page);
      await expect(editorOf(page)).toHaveCount(0);
      await expect(row).toHaveCount(0);
      await saved(changes, before);
      await page.waitForTimeout(1500);
      expect(changes.sent - before).toBe(1);
      await expect(page.getByText(MISSING)).toHaveCount(0);
      await expect(page.getByText(EMPTY)).toBeVisible();
      await expect(memoryRow(page, "!")).toHaveCount(0);
    });
  }
);

test.describe("Memory editor beside the list at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("closes with the memory the learner deletes from its row, and saves nothing more", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyRowDeleteWithEditor(page, origin))
        )
      )
    );
  });
});
