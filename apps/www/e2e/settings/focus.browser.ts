import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  ANSWER_MILLISECONDS,
  reloadUntil,
  saved,
  trackChanges,
} from "@/e2e/support/changes";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import {
  LAST_SERVER,
  NEWEST,
  OLDEST,
  writeLongList,
  writeMemory,
} from "@/e2e/support/list";
import {
  EMPTY,
  editorOf,
  LIST_QUERY,
  MEMORY_PATH,
  memoryRow,
  nameOf,
  opened,
  openMemoryPage,
  runMemory,
} from "@/e2e/support/memory";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const WRITTEN = "Prefers worked examples before the formula";
const SECOND = "Revises the proofs on Sundays";
/** The Convex name of `nina.memory.pause`, the mutation behind the switch. */
const PAUSE_MUTATION = "nina/memory:pause";
/** The switch that lets Nina save and use memories. */
const REMEMBER = "Let Nina save and use memories";
/** The title of the Memory page. */
const MEMORY_TITLE = /Memory/;

/** The search field of the list, which stays on the page whatever the list holds. */
const searchOf = (page: Page) =>
  page.getByRole("searchbox", { name: "Search memories" });

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
 * Deleting from the editor while other memories remain moves the focus to the
 * list, because the row the editor held is gone.
 */
const deletesToTheList = Effect.fn("NakafaE2E.memoryDeletesToList")(function* (
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
    await expect(editorOf(page)).toHaveCount(0);
    await expect(memoryRow(page, SECOND)).toHaveCount(0);
    await expect(page.locator("#user-settings-memory-list")).toBeFocused();
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
 * to the search field, which is still on the page.
 */
const deletesLastToSearch = Effect.fn("NakafaE2E.memoryDeletesLast")(function* (
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
    await expect(row).toHaveCount(0);
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(searchOf(page)).toBeFocused();
  });
});

/**
 * A long list shows its first page in a window. Deleting the memory that takes
 * the list below the window's threshold replaces the list element, and the focus
 * must not fall to the body: it goes to the search field instead.
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
    await expect(row).toHaveCount(0);
    await expect(searchOf(page)).toBeFocused();
    await expect(memoryRow(page, LAST_SERVER)).toBeVisible();
  });
});

/**
 * "Delete all" asks first. Once the learner confirms, the button that opened the
 * dialog is disabled, so the focus goes to the search field instead.
 */
const clearsToSearch = Effect.fn("NakafaE2E.memoryClearsToSearch")(function* (
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
    await expect(searchOf(page)).toBeFocused();
  });
});

/**
 * The switch moves on the press, before the server answers, though the page has
 * not read whether memory is paused yet: the answers are held from the first
 * load. A refused change returns the switch once the server refuses it.
 */
const pausesBeforeTheAnswer = Effect.fn("NakafaE2E.memoryPausesBeforeAnswer")(
  function* (page: Page, baseURL: string, refused: boolean) {
    const changes = yield* trackChanges(page, [LIST_QUERY]);
    yield* seedAnalyticsConsent(page, "denied");
    yield* signInLearner(page.context(), baseURL);
    changes.hold();
    if (refused) {
      changes.failNext(PAUSE_MUTATION);
    }

    yield* Effect.promise(async () => {
      await page.goto(MEMORY_PATH);
      await expect(page).toHaveTitle(MEMORY_TITLE);
      const remember = page.getByRole("switch", { name: REMEMBER });
      const before = changes.sent;

      await expect(remember).toBeChecked();
      // The page shows the switch before its code runs, and a press in that
      // moment is lost, so the press is repeated until the switch moves.
      await expect(async () => {
        if (await remember.isChecked()) {
          await remember.click();
        }
        await expect(remember).not.toBeChecked({ timeout: 1000 });
      }).toPass({ timeout: ANSWER_MILLISECONDS });

      changes.release();
      await saved(changes, before);
      if (refused) {
        await expect(remember).toBeChecked();
      } else {
        await expect(remember).not.toBeChecked();
      }
    });
  }
);

test.describe("Memory editor focus at 390px and 1440px", () => {
  test.describe.configure({ timeout: 180_000 });

  for (const width of [390, 1440]) {
    test.describe(`Memory editor at ${width}px`, () => {
      test.use({ viewport: { height: 900, width } });

      test("returns the focus to the row when the editor closes", async ({
        baseURL,
        page,
      }) => {
        await runMemory(page, baseURL, closesToTheRow);
      });

      test("moves the focus to the list when the editor deletes its memory", async ({
        baseURL,
        page,
      }) => {
        await runMemory(page, baseURL, deletesToTheList);
      });
    });
  }
});

test.describe("Memory focus and the switch at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("returns the focus to the Add button when a new memory closes", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, closesNewToAdd);
  });

  test("moves the focus to the search field when the last memory goes", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, deletesLastToSearch);
  });

  test("keeps the focus when a delete crosses the window threshold", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, deletesAcrossTheThreshold);
  });

  test("moves the focus to the search field once Delete all is confirmed", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, clearsToSearch);
  });

  test("moves the switch before the server answers, though the page has not read the state", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, (flowPage, origin) =>
      pausesBeforeTheAnswer(flowPage, origin, false)
    );
  });

  test("returns the switch when the server refuses the change", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, (flowPage, origin) =>
      pausesBeforeTheAnswer(flowPage, origin, true)
    );
  });
});
