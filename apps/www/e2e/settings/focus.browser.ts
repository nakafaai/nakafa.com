import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { reloadUntil, saved } from "@/e2e/support/changes";
import { runOnPage } from "@/e2e/support/chat";
import {
  LAST_SERVER,
  NEWEST,
  OLDEST,
  SECOND_NEWEST,
  writeLongList,
  writeMemory,
} from "@/e2e/support/list";
import {
  confirmDelete,
  EMPTY,
  editorOf,
  memoryRow,
  nameOf,
  opened,
  openMemoryPage,
} from "@/e2e/support/memory";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const WRITTEN = "Prefers worked examples before the formula";
const SECOND = "Revises the proofs on Sundays";

/** Opens the memory that a row names, and waits until its editor holds the words and the focus. */
const openRow = async (page: Page, text: string) => {
  await expect(memoryRow(page, text)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await nameOf(page, text).click();
  await opened(page, text);
};

/**
 * Closing the editor with its close button gives the focus back to the row that
 * opened it. It holds at 390px too, where the editor is a sheet.
 */
const closesToTheRow = Effect.fn("NakafaE2E.memoryClosesToRow")(function* (
  page: Page,
  baseURL: string
) {
  yield* openMemoryPage(page, baseURL);
  yield* writeMemory(page, WRITTEN);

  yield* Effect.promise(async () => {
    await openRow(page, WRITTEN);
    await page.getByRole("button", { exact: true, name: "Close" }).click();
    await expect(editorOf(page)).toHaveCount(0);
    await expect(nameOf(page, WRITTEN)).toBeFocused();
  });
});

/**
 * Deleting from the editor while other memories remain gives the focus to the
 * memory that took the deleted one's place in the list.
 */
const deletesToNext = Effect.fn("NakafaE2E.memoryDeletesToNext")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);
  const before = changes.sent;
  yield* writeMemory(page, WRITTEN);
  yield* writeMemory(page, SECOND);

  yield* Effect.promise(async () => {
    await openRow(page, SECOND);
    await page.getByRole("button", { exact: true, name: "Delete" }).click();
    await confirmDelete(page);
    await expect(editorOf(page)).toHaveCount(0);
    await expect(memoryRow(page, SECOND)).toHaveCount(0);
    await expect(nameOf(page, WRITTEN)).toBeFocused();
    await saved(changes, before);
  });
});

/**
 * A new memory that its first save has stored is still the memory the Add button
 * opened, so closing the editor returns the focus to that button, not to the row
 * the save made.
 */
const closesNewToAdd = Effect.fn("NakafaE2E.memoryClosesNewToAdd")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);
  const before = changes.sent;

  yield* Effect.promise(async () => {
    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    await page.keyboard.type(WRITTEN);
    await saved(changes, before);
    await expect(memoryRow(page, WRITTEN)).toBeVisible();
    await editorOf(page).press("Escape");
    await expect(editorOf(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add memory" })
    ).toBeFocused();
  });
});

/**
 * Deleting the only memory from its row leaves the list empty, so the focus goes
 * to the Add memory button.
 */
const deletesLastToAdd = Effect.fn("NakafaE2E.memoryDeletesLast")(function* (
  page: Page,
  baseURL: string
) {
  yield* openMemoryPage(page, baseURL);
  yield* writeMemory(page, WRITTEN);

  yield* Effect.promise(async () => {
    const row = memoryRow(page, WRITTEN);

    await expect(row).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await row.hover();
    await row.getByRole("button", { name: "Delete memory" }).click();
    await confirmDelete(page);
    await expect(row).toHaveCount(0);
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add memory" })
    ).toBeFocused();
  });
});

/**
 * A long list shows its first page in a window. Deleting the newest memory takes
 * the list below the window's threshold, which replaces the list element. The
 * focus must not fall to the body: it goes to the memory that took the newest
 * one's place, the second on the list.
 */
const deletesAcrossTheThreshold = Effect.fn(
  "NakafaE2E.memoryDeletesAcrossThreshold"
)(function* (page: Page, baseURL: string) {
  const changes = yield* openMemoryPage(page, baseURL);
  yield* writeLongList(page, changes);

  yield* Effect.promise(async () => {
    // Written on this page, the list holds every memory. A fresh page shows
    // its first page only, which is the window of exactly one page.
    await reloadUntil(page, () =>
      expect(memoryRow(page, NEWEST)).toBeVisible({ timeout: 3000 })
    );
    await expect(memoryRow(page, OLDEST)).toHaveCount(0);
    const row = memoryRow(page, NEWEST);

    await row.hover();
    await row.getByRole("button", { name: "Delete memory" }).click();
    await confirmDelete(page);
    await expect(row).toHaveCount(0);
    await expect(nameOf(page, SECOND_NEWEST)).toBeFocused();
    await expect(memoryRow(page, LAST_SERVER)).toBeVisible();
  });
});

/**
 * "Delete all" asks first. Once the learner confirms, the button that opened the
 * dialog is disabled, so the focus goes to the Add memory button instead.
 */
const clearsToAdd = Effect.fn("NakafaE2E.memoryClearsToAdd")(function* (
  page: Page,
  baseURL: string
) {
  yield* openMemoryPage(page, baseURL);
  yield* writeMemory(page, WRITTEN);

  yield* Effect.promise(async () => {
    await expect(memoryRow(page, WRITTEN)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { exact: true, name: "Delete all" }).click();
    const dialog = page.getByRole("dialog");

    await dialog
      .getByRole("button", { exact: true, name: "Delete all" })
      .click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add memory" })
    ).toBeFocused();
  });
});

test.describe("Memory editor focus at 390px and 1440px", () => {
  test.describe.configure({ timeout: 180_000 });

  for (const width of [390, 1440]) {
    test.describe(`Memory editor at ${width}px`, () => {
      test.use({ viewport: { height: 900, width } });

      test("returns the focus to the row when the editor closes", async ({
        baseURL,
        page,
      }) => {
        await runOnPage(page, baseURL, (origin) =>
          closesToTheRow(page, origin)
        );
      });

      test("moves the focus to the next memory when the editor deletes its memory", async ({
        baseURL,
        page,
      }) => {
        await runOnPage(page, baseURL, (origin) => deletesToNext(page, origin));
      });
    });
  }
});

test.describe("Memory focus at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("returns the focus to the Add button when a new memory closes", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => closesNewToAdd(page, origin));
  });

  test("moves the focus to the Add button when the last memory goes", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => deletesLastToAdd(page, origin));
  });

  test("moves the focus to the next memory when a delete crosses the window threshold", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      deletesAcrossTheThreshold(page, origin)
    );
  });

  test("moves the focus to the Add button once Delete all is confirmed", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => clearsToAdd(page, origin));
  });
});
