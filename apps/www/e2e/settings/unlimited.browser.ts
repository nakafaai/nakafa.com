import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  live,
  reloadUntil,
  saved,
} from "@/e2e/support/changes";
import {
  LATE,
  NEWEST,
  OLDEST,
  OLDEST_WORD,
  writeLongList,
} from "@/e2e/support/list";
import {
  EMPTY,
  editorOf,
  memoryRow,
  NO_RESULT,
  opened,
  openMemoryPage,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  firstRow,
  hydratesInPlace,
  hydratesInPlaceAtLargeText,
  isHydrated,
  reachesRows,
} from "@/e2e/support/window";

const OLDEST_REVISED = "Astronomy club moved to Mondays";
const EXTENDED = " and the Oort cloud";

/** The search box of the list. */
const searchOf = (page: Page) =>
  page.getByRole("searchbox", { name: "Search memories" });

/**
 * Reloads the page so that only its first page of the list is loaded, and
 * waits until React has taken the page over, because words typed before that
 * are lost.
 */
const reloadFresh = (page: Page, changes: Changes) =>
  Effect.promise(async () => {
    await page.reload();
    await expect(memoryRow(page, NEWEST)).toBeVisible();
    await expect(memoryRow(page, OLDEST)).toHaveCount(0);
    await expect
      .poll(() => isHydrated(firstRow(page)), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(true);
    await live(changes);
  });

/**
 * The oldest memory is not on the page that loads first. Its word finds it all
 * the same, because a search loads every page, and the rows that match appear
 * as their pages arrive. Until every page is loaded, a search that finds
 * nothing says nothing, and once they are loaded it says so.
 */
const searchesEveryPage = Effect.fn("NakafaE2E.searchesEveryPage")(function* (
  page: Page,
  changes: Changes
) {
  yield* reloadFresh(page, changes);
  yield* Effect.promise(async () => {
    const search = searchOf(page);

    // The server's answers are held back, so no page after the first arrives.
    changes.hold();
    await search.fill(OLDEST_WORD);
    await page.waitForTimeout(1500);
    await expect(memoryRow(page, OLDEST)).toHaveCount(0);
    await expect(page.getByText(NO_RESULT)).toBeHidden();

    changes.release();
    await expect(memoryRow(page, OLDEST)).toBeVisible({
      timeout: ANSWER_MILLISECONDS,
    });
    await expect(memoryRow(page, NEWEST)).toHaveCount(0);

    await search.fill("zzzzqq");
    await expect(page.getByText(NO_RESULT)).toBeVisible();
    await search.fill("");
    await expect(memoryRow(page, NEWEST)).toBeVisible();
  });
});

/**
 * The page scrolls, and the next page loads when the end of the list comes
 * into view: scrolling to the bottom brings the oldest memory in as the last
 * row.
 */
const scrollsToOldest = Effect.fn("NakafaE2E.scrollsToOldest")(function* (
  page: Page,
  changes: Changes
) {
  yield* reloadFresh(page, changes);
  yield* Effect.promise(async () => {
    await expect(async () => {
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );
      await expect(memoryRow(page, OLDEST)).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: ANSWER_MILLISECONDS });
    await expect(page.locator("main ul > li").last()).toContainText(OLDEST);
  });
});

/**
 * Rewriting the oldest memory moves it to the top of the list at once and for
 * good: it is still first after a reload.
 */
const revisesOldest = Effect.fn("NakafaE2E.revisesOldest")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const before = changes.sent;

    await memoryRow(page, OLDEST).getByText(OLDEST).click();
    await opened(page, OLDEST);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(OLDEST_REVISED);
    await editorOf(page).press("Escape");
    await expect(editorOf(page)).toHaveCount(0);
    // The list is scrolled to its end, and the memory moved to its top.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(firstRow(page)).toContainText(OLDEST_REVISED);
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(firstRow(page)).toContainText(OLDEST_REVISED, { timeout: 3000 })
    );
  });
});

/**
 * On a wide screen the editor is a panel beside the list, and the learner can
 * change the search while it is open. The memory stays in the editor when the
 * search no longer matches it, with the words, the caret and the undo history
 * the editor held, and the editor never closes and opens again on the way.
 */
const keepsEditorWhileSearching = Effect.fn(
  "NakafaE2E.keepsEditorWhileSearching"
)(function* (page: Page) {
  yield* Effect.promise(async () => {
    const search = searchOf(page);
    const editor = editorOf(page);
    const closed = await page.evaluateHandle(() => {
      const log = { removed: 0 };
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.removedNodes) {
            if (
              node instanceof Element &&
              (node.matches('[aria-label="Memory text"]') ||
                node.querySelector('[aria-label="Memory text"]'))
            ) {
              log.removed += 1;
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
      return log;
    });

    await search.fill("mondays");
    await memoryRow(page, OLDEST_REVISED).getByText(OLDEST_REVISED).click();
    await opened(page, OLDEST_REVISED);
    await page.keyboard.type(EXTENDED);
    await expect(editor).toHaveText(`${OLDEST_REVISED}${EXTENDED}`);

    // No memory matches this any more, and the editor is the same one.
    await search.fill("zzzzqq");
    await expect(page.getByText(NO_RESULT)).toBeVisible();
    await expect(editor).toHaveText(`${OLDEST_REVISED}${EXTENDED}`);

    // The caret is where it was, and the history holds both steps.
    await editor.focus();
    await page.waitForTimeout(600);
    await page.keyboard.type("!");
    await expect(editor).toHaveText(`${OLDEST_REVISED}${EXTENDED}!`);
    await page.waitForTimeout(600);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).toHaveText(`${OLDEST_REVISED}${EXTENDED}`);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).toHaveText(OLDEST_REVISED);

    await search.fill("");
    await expect(editor).toHaveText(OLDEST_REVISED);
    expect(await closed.evaluate((log) => log.removed)).toBe(0);
    await page.getByRole("button", { exact: true, name: "Close" }).click();
    await expect(editor).toHaveCount(0);
  });
});

/**
 * Delete all asks first and names no memory, because the page holds only some
 * of them. Confirming empties the list at once, while the server's answer is
 * still on its way, and the list stays empty after a reload.
 */
const clearsEverything = Effect.fn("NakafaE2E.clearsEverything")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const dialog = page.getByRole("dialog");
    const before = changes.sent;

    // The list is live once a memory that only the second page holds is found.
    await searchOf(page).fill(LATE);
    await expect(memoryRow(page, LATE)).toBeVisible({
      timeout: ANSWER_MILLISECONDS,
    });
    await searchOf(page).fill("");
    await page
      .locator("main")
      .getByRole("button", { exact: true, name: "Delete all" })
      .click();
    await expect(dialog.getByText("Delete all memories?")).toBeVisible();
    await expect(dialog.getByRole("listitem")).toHaveCount(0);
    await expect(dialog.getByText(NEWEST)).toHaveCount(0);

    changes.hold();
    await dialog
      .getByRole("button", { exact: true, name: "Delete all" })
      .click();
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(memoryRow(page, NEWEST)).toHaveCount(0);

    changes.release();
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(page.getByText(EMPTY)).toBeVisible({ timeout: 3000 })
    );
  });
});

/**
 * Signs a synthetic learner in and walks a list of more memories than one
 * page: it writes them, checks that the server's rows stand in the same places
 * once React has taken them over, also at a larger text size, searches every
 * page, scrolls to the end, walks the rows with the keyboard, rewrites the
 * oldest, keeps an editor open through a change of the search, and deletes
 * everything.
 */
const verifyLongList = Effect.fn("NakafaE2E.verifyLongList")(function* (
  page: Page,
  baseURL: string,
  wide: boolean
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* writeLongList(page, changes);
  yield* hydratesInPlace(page);
  yield* hydratesInPlaceAtLargeText(page);
  yield* searchesEveryPage(page, changes);
  yield* scrollsToOldest(page, changes);
  yield* reachesRows(page);
  yield* scrollsToOldest(page, changes);
  yield* revisesOldest(page, changes);
  if (wide) {
    yield* keepsEditorWhileSearching(page);
  }
  yield* clearsEverything(page, changes);
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
            Effect.flatMap((origin) =>
              verifyLongList(page, origin, width > 800)
            )
          )
        )
      );
    });
  });
}
