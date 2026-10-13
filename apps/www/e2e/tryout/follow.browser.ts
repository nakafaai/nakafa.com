import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { activate } from "@/e2e/support/input";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  currentNumberOf,
  expectView,
  numberCells,
  questionArticle,
  runFirstSection,
  scrollPageBy,
  scrollPageTo,
  scrollToQuestion,
  sidebarOf,
  waitForObservers,
} from "@/e2e/support/player";
import { desktopViewport, tryoutViewports } from "@/e2e/support/viewport";

/** How much taller than its page a window is made, so the whole list fits in it. */
const FITTING_ROOM = 200;

/** The size of the root text of a browser that shows text larger than its default 16 px. */
const LARGER_TEXT = 20;

/**
 * Gives the current number back to a reader who moves the page without a
 * wheel, a touch, or a key, as one who drags the scrollbar does, after a jump
 * held it on the question the jump chose.
 */
const verifyScrollbar = Effect.fn("NakafaE2E.verifyPlayerScrollbar")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  yield* runFirstSection(page, hasTouch, baseURL);
  // The questions stream in after the header, so wait for them before keys.
  yield* expectView(page, "List");
  const current = currentNumberOf(page, hasTouch);
  const total = yield* Effect.promise(() => numberCells(page).count());
  yield* Effect.promise(() => expect(current).toHaveText("1"));

  // A jump holds its question, wherever the reading line is.
  yield* Effect.promise(() => page.keyboard.press("ArrowRight"));
  yield* Effect.promise(() => expect(current).toHaveText("2"));

  // The scrollbar sends a scroll and nothing else, and the number follows it.
  yield* scrollPageTo(page, "end");
  yield* Effect.promise(() => expect(current).toHaveText(String(total)));
  yield* scrollPageTo(page, "start");
  yield* Effect.promise(() => expect(current).toHaveText("1"));
});

/**
 * Keeps the first question current when the window grows until the whole list
 * fits in it. The reader has not scrolled, so there is no end of the list that
 * they reached.
 */
const verifyFittingList = Effect.fn("NakafaE2E.verifyFittingList")(function* (
  page: Page,
  baseURL: string
) {
  yield* runFirstSection(page, false, baseURL);
  yield* expectView(page, "List");
  const current = currentNumberOf(page, false);
  const total = yield* Effect.promise(() => numberCells(page).count());
  yield* Effect.promise(() => expect(current).toHaveText("1"));

  // The window becomes taller than the page, so the end of the list is in view.
  const height = yield* Effect.promise(() =>
    page.evaluate(() => document.documentElement.scrollHeight)
  );
  yield* Effect.promise(() =>
    page.setViewportSize({
      height: height + FITTING_ROOM,
      width: desktopViewport.width,
    })
  );
  yield* waitForObservers(page);
  const room = yield* Effect.promise(() =>
    questionArticle(page, total).evaluate(
      (article) =>
        (document.querySelector("[data-player-footer]")?.getBoundingClientRect()
          .top ?? 0) - article.getBoundingClientRect().bottom
    )
  );
  yield* Effect.sync(() => expect(room).toBeGreaterThan(0));
  yield* Effect.promise(() => expect(current).toHaveText("1"));
});

/**
 * Keeps the question that a jump chose current when the browser shows larger
 * text, where every length in rem grows and the reading line has to follow the
 * place a revealed question rests at.
 */
const verifyLargerText = Effect.fn("NakafaE2E.verifyLargerText")(function* (
  page: Page,
  baseURL: string
) {
  yield* runFirstSection(page, false, baseURL);
  yield* expectView(page, "List");
  const current = currentNumberOf(page, false);

  // Larger text, and a resize, which makes the observers measure the page again.
  yield* Effect.promise(() =>
    page.addStyleTag({ content: `html { font-size: ${LARGER_TEXT}px; }` })
  );
  yield* Effect.promise(() =>
    page.setViewportSize({
      height: desktopViewport.height + 1,
      width: desktopViewport.width,
    })
  );
  yield* waitForObservers(page);

  // The reader is on the second question, jumps to the fifth, and moves the page a little.
  yield* scrollToQuestion(page, 2);
  yield* waitForObservers(page);
  yield* Effect.promise(() => expect(current).toHaveText("2"));
  yield* activate(
    sidebarOf(page).getByRole("button", {
      exact: true,
      name: "Question 5, unanswered",
    }),
    false
  );
  yield* Effect.promise(() => expect(current).toHaveText("5"));
  yield* waitForObservers(page);
  yield* scrollPageBy(page, 10);
  yield* waitForObservers(page);
  yield* Effect.promise(() => expect(current).toHaveText("5"));
});

for (const viewport of tryoutViewports) {
  test.describe(`Try-out player follows the reader on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("when the reader moves the page without a wheel, a touch, or a key", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) =>
              verifyScrollbar(page, viewport.hasTouch, origin)
            )
          )
        )
      );
    });
  });
}

test.describe("Try-out player follows the reader when the window or the text changes", () => {
  test.use({
    hasTouch: desktopViewport.hasTouch,
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("keeps the first question current when the whole list fits in the window", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyFittingList(page, origin))
        )
      )
    );
  });

  test("keeps the question a jump chose current when the text is larger", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyLargerText(page, origin))
        )
      )
    );
  });
});
