import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { ANSWER_MILLISECONDS } from "../support/changes";
import {
  CHAT_PATH,
  LESSON_PATH,
  openChatPage,
  PAGE,
  runOnPage,
} from "../support/chat";
import {
  historyRows,
  markedRows,
  markRows,
  pageRows,
  placesOf,
  scrollToEnd,
  settled,
  sidebarRows,
  sidebarScroller,
  sidebarSearch,
} from "../support/rows";
import { readinessTimeoutMilliseconds } from "../support/timeout";

/** The chats after the first page, beside the chat that waits at the end. */
const LATER = 5;
/** Every chat of the learner: the started one, and the ones the test imports. */
const ALL = PAGE + LATER + 1;
const FIRST_TITLES = ["Limits of sine", "Limits of cosine", "Plan for Sunday"];
/** The names a press that loads more of a list would go by. */
const LOAD_MORE = /show more|load more/i;

/** No list says it needs a press to load more. */
const noButton = (page: Page) =>
  expect(page.getByRole("button", { name: LOAD_MORE })).toHaveCount(0);

/**
 * A learner with more chats than one page holds. The first chat they started
 * waits at the end of every list, and the newest three are named, so a search
 * has something to find.
 */
const seedLongList = Effect.fn("NakafaE2E.seedLongList")(function* (
  page: Page,
  baseURL: string
) {
  const { changes, learner } = yield* openChatPage(page, baseURL);
  const started = yield* learner.startChat("A chat that waits at the end");
  yield* learner.importChats(started.threadId, PAGE + LATER);
  yield* learner.titleNewest(FIRST_TITLES);
  return { changes, learner };
});

/**
 * The end of a list comes into view and the next page loads on its own: the
 * rows of the first page are the same elements, standing in the same places
 * when the next page is there, so nothing blinks or moves.
 */
const loadsNextPageAtItsEnd = (
  page: Page,
  rows: Locator,
  scroller: Locator | undefined
) =>
  Effect.promise(async () => {
    await expect(rows).toHaveCount(PAGE, {
      timeout: readinessTimeoutMilliseconds,
    });
    await noButton(page);
    await settled(rows);
    await markRows(rows);
    const before = await placesOf(rows);

    await scrollToEnd(page, scroller);
    await expect(rows).toHaveCount(ALL, { timeout: ANSWER_MILLISECONDS });

    expect(await markedRows(rows)).toBe(PAGE);
    expect(Arr.take(await placesOf(rows), PAGE)).toEqual(before);
    await noButton(page);
  });

/** The learner's chats page. */
const chatsPage = Effect.fn("NakafaE2E.chatsPageLoadsMore")(function* (
  page: Page,
  baseURL: string
) {
  const { learner } = yield* seedLongList(page, baseURL);

  yield* Effect.promise(() => page.goto(`/en/@${learner.username}/chat`));
  yield* loadsNextPageAtItsEnd(page, pageRows(page), undefined);
});

/** The history of Nina's sheet on a lesson. */
const sheetHistory = Effect.fn("NakafaE2E.sheetHistoryLoadsMore")(function* (
  page: Page,
  baseURL: string
) {
  yield* seedLongList(page, baseURL);

  yield* Effect.promise(async () => {
    await page.goto(LESSON_PATH);
    await page.getByRole("button", { exact: true, name: "Ask Nina" }).click();
    await page.getByRole("button", { name: "Chat history" }).click();
  });
  yield* loadsNextPageAtItsEnd(
    page,
    historyRows(page),
    page.locator('[role="menu"]')
  );
});

/** Opens the sidebar of the new chat page, which a phone shows in a sheet. */
const openSidebar = (page: Page, narrow: boolean) =>
  Effect.promise(async () => {
    await page.goto(CHAT_PATH);
    if (narrow) {
      await page.getByRole("button", { name: "Chat history" }).click();
    }
  });

/** The sidebar beside a chat. */
const sidebar = Effect.fn("NakafaE2E.sidebarLoadsMore")(function* (
  page: Page,
  baseURL: string,
  narrow: boolean
) {
  yield* seedLongList(page, baseURL);

  yield* openSidebar(page, narrow);
  yield* loadsNextPageAtItsEnd(page, sidebarRows(page), sidebarScroller(page));
});

/**
 * Searching the sidebar keeps the rows it shows while the answer is on its
 * way, and then shows the chats that match: two, then none, then the first
 * page again once the search is cleared.
 */
const sidebarSearching = Effect.fn("NakafaE2E.sidebarKeepsRowsWhileSearching")(
  function* (page: Page, baseURL: string, narrow: boolean) {
    const { changes } = yield* seedLongList(page, baseURL);
    const rows = sidebarRows(page);
    const search = sidebarSearch(page);

    yield* openSidebar(page, narrow);
    yield* Effect.promise(async () => {
      await expect(rows).toHaveCount(PAGE, {
        timeout: readinessTimeoutMilliseconds,
      });
      await markRows(rows);

      // The answers are held back, so the new search has no first page yet.
      changes.hold();
      await search.fill("limits");
      await page.waitForTimeout(1500);
      expect(await rows.count()).toBe(PAGE);
      expect(await markedRows(rows)).toBe(PAGE);

      changes.release();
      await expect(rows).toHaveCount(2, { timeout: ANSWER_MILLISECONDS });
      await expect(rows.first()).toHaveText(FIRST_TITLES[0] ?? "");

      await search.fill("zzzzqq");
      await expect(rows).toHaveCount(0, { timeout: ANSWER_MILLISECONDS });

      await search.fill("");
      await expect(rows).toHaveCount(PAGE, { timeout: ANSWER_MILLISECONDS });
    });
  }
);

for (const width of [390, 1440]) {
  test.describe(`Chat lists at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });
    test.describe.configure({ timeout: 180_000 });
    const narrow = width < 800;

    test("the chats page loads its next page when its end comes into view", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) => chatsPage(page, origin));
    });

    test("the history of the sheet loads its next page when its end comes into view", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) => sheetHistory(page, origin));
    });

    test("the sidebar loads its next page when its end comes into view", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) => sidebar(page, origin, narrow));
    });

    test("the sidebar keeps its rows while a search loads", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        sidebarSearching(page, origin, narrow)
      );
    });
  });
}
