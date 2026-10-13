import { expect, type Page, test } from "@playwright/test";
import { Deferred, Effect, Option } from "effect";
import { activate } from "@/e2e/support/input";
import { expectUncovered } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  chooseView,
  countSentQuestions,
  currentNumberOf,
  expectView,
  numberCells,
  openSurface,
  questionArticle,
  questionHeading,
  readRememberedView,
  runFirstSection,
  scrollPageTo,
  shownQuestions,
  sidebarOf,
} from "@/e2e/support/player";
import {
  expectStillShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, tryoutViewports } from "@/e2e/support/viewport";

/** The height of a window that is short enough for the sidebar to scroll. */
const SHORT_WINDOW_HEIGHT = 400;

/** An address whose `view` parameter names one question at a time. */
const SINGLE_VIEW_ADDRESS = /[?&]view=single(&|$)/;

/** What the learner is told when the server cannot save the view. */
const VIEW_ERROR = "We couldn't save your view. Please try again.";

/** The address of the running section with a `view` parameter, or without one. */
function withView(address: string, view?: string) {
  const url = new URL(address);
  url.searchParams.delete("view");
  if (view !== undefined) {
    url.searchParams.set("view", view);
  }
  return url.toString();
}

/** Waits until the server has stored the view that the learner chose. */
const expectRemembered = Effect.fn("NakafaE2E.expectViewRemembered")(function* (
  page: Page,
  value: string
) {
  yield* Effect.promise(() =>
    expect
      .poll(async () => Option.getOrUndefined(await readRememberedView(page)), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(value)
  );
});

/**
 * Opens an address and counts the questions in the document the server sent,
 * which proves the view was resolved before the page was sent.
 */
const sentQuestions = Effect.fn("NakafaE2E.sentQuestions")(function* (
  page: Page,
  address: string
) {
  const response = yield* Effect.promise(() =>
    page.goto(address, { waitUntil: "commit" })
  );
  return yield* countSentQuestions(response);
});

/**
 * Resolves the view from the address, then the learner's saved view, then the
 * list, on the server, and keeps the page still while the view changes and the
 * timer ticks.
 */
const verifyView = Effect.fn("NakafaE2E.verifyPlayerView")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  yield* runFirstSection(page, hasTouch, baseURL);
  const address = page.url();
  yield* expectView(page, "List");

  // With nothing saved, the list; the address alone names the other view.
  const listed = yield* sentQuestions(page, withView(address));
  yield* Effect.sync(() => expect(listed).toBeGreaterThan(1));
  const named = yield* sentQuestions(page, withView(address, "single"));
  yield* Effect.sync(() => expect(named).toBe(1));
  yield* expectView(page, "One question");
  const unsaved = yield* Effect.promise(() => readRememberedView(page));
  yield* Effect.sync(() => expect(Option.isNone(unsaved)).toBe(true));

  // An unknown view is not a page.
  yield* Effect.promise(() =>
    page.goto(withView(address, "grid"), { waitUntil: "domcontentloaded" })
  );
  yield* Effect.promise(() =>
    expect(
      page.locator('meta[name="robots"][content*="noindex"]').first()
    ).toBeAttached({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() => expect(shownQuestions(page)).toHaveCount(0));

  // Choosing a view shows it at once, without moving the page, while the
  // timer keeps ticking, and the server remembers it.
  yield* Effect.promise(() => page.goto(address, { waitUntil: "commit" }));
  yield* expectView(page, "List");
  yield* Effect.promise(() =>
    expect(
      page.getByRole("button", { exact: true, name: "Finish" })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  // Late streamed content would still move the page, so let it settle.
  yield* Effect.sleep("750 millis");
  const since = yield* readPageTime(page);
  yield* chooseView(page, hasTouch, "One question");
  yield* expectView(page, "One question");
  yield* expectRemembered(page, "single");
  yield* Effect.sleep("2 seconds");
  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => expectStillShell(observation, [true]));

  // The saved view is the first one after a reload, and the address still wins.
  const saved = yield* sentQuestions(page, withView(address));
  yield* Effect.sync(() => expect(saved).toBe(1));
  const overridden = yield* sentQuestions(page, withView(address, "list"));
  yield* Effect.sync(() => expect(overridden).toBeGreaterThan(1));

  // Choosing a view again keeps the address in step, so a reload cannot undo it.
  yield* chooseView(page, hasTouch, "One question");
  yield* Effect.promise(() =>
    expect(page).toHaveURL(SINGLE_VIEW_ADDRESS, {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* expectView(page, "One question");
});

/**
 * Shows a chosen view at once, and takes it back with a message when the
 * server cannot save it. The save waits until the view is on screen, so the
 * check never races the failure.
 */
const verifyRollback = Effect.fn("NakafaE2E.verifyPlayerRollback")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  yield* runFirstSection(page, hasTouch, baseURL);
  yield* expectView(page, "List");

  const sectionPath = new URL(page.url()).pathname;
  const failSave = yield* Deferred.make<void>();
  const services = yield* Effect.context<never>();
  yield* Effect.promise(() =>
    page.route(
      (url) => url.pathname === sectionPath,
      (route) =>
        route.request().headers()["next-action"] === undefined
          ? route.continue()
          : Effect.runPromiseWith(services)(
              Deferred.await(failSave).pipe(
                Effect.andThen(() => Effect.promise(() => route.abort()))
              )
            )
    )
  );

  yield* chooseView(page, hasTouch, "One question");
  yield* expectView(page, "One question");

  yield* Deferred.succeed(failSave, undefined);
  yield* expectView(page, "List");
  yield* Effect.promise(() =>
    expect(page.getByText(VIEW_ERROR)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  const unsaved = yield* Effect.promise(() => readRememberedView(page));
  yield* Effect.sync(() => expect(Option.isNone(unsaved)).toBe(true));
});

/**
 * Moves between questions with the keys and the navigator, answers from the
 * keyboard, and goes back to a question that is still open from the finish
 * confirmation.
 */
const verifyKeys = Effect.fn("NakafaE2E.verifyPlayerKeys")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  yield* runFirstSection(page, hasTouch, baseURL);
  // The questions stream in after the header, so wait for them before keys.
  yield* expectView(page, "List");
  const current = currentNumberOf(page, hasTouch);
  yield* Effect.promise(() => expect(current).toHaveText("1"));

  // The arrows move through the list and keep each question under the header.
  yield* Effect.promise(() => page.keyboard.press("ArrowRight"));
  yield* Effect.promise(() => expect(current).toHaveText("2"));
  yield* expectUncovered(
    questionHeading(page, 2),
    readinessTimeoutMilliseconds
  );

  // A digit picks the option at that place in the current question.
  yield* Effect.promise(() => page.keyboard.press("3"));
  yield* Effect.promise(() =>
    expect(questionArticle(page, 2).getByRole("radio").nth(2)).toBeChecked()
  );
  yield* Effect.promise(() => page.keyboard.press("ArrowLeft"));
  yield* Effect.promise(() => expect(current).toHaveText("1"));

  // G opens the sheet below the large breakpoint, and moves focus into the
  // column from it, and the same key leaves again.
  if (hasTouch) {
    yield* Effect.promise(() => page.keyboard.press("g"));
    yield* Effect.promise(() =>
      expect(openSurface(page)).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      })
    );
    yield* Effect.promise(() =>
      expect(
        openSurface(page).getByRole("button", {
          exact: true,
          name: "Question 2, answered",
        })
      ).toBeVisible()
    );
    yield* Effect.promise(() => page.keyboard.press("g"));
    yield* Effect.promise(() =>
      expect(openSurface(page)).toBeHidden({
        timeout: readinessTimeoutMilliseconds,
      })
    );
  } else {
    yield* Effect.promise(() => page.keyboard.press("g"));
    yield* Effect.promise(() => expect(current).toBeFocused());
    yield* Effect.promise(() =>
      expect(
        sidebarOf(page).getByRole("button", {
          exact: true,
          name: "Question 2, answered",
        })
      ).toBeVisible()
    );
    yield* Effect.promise(() => page.keyboard.press("g"));
    yield* Effect.promise(() => expect(questionArticle(page, 1)).toBeFocused());
  }

  // The confirmation lists what is still open, and a number leads back to it.
  yield* activate(
    page.getByRole("button", { exact: true, name: "Finish" }),
    hasTouch
  );
  const confirmation = openSurface(page);
  yield* Effect.promise(() =>
    expect(
      confirmation.getByRole("heading", { exact: true, name: "Unanswered" })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() =>
    expect(
      confirmation.getByRole("button", {
        exact: true,
        name: "Question 2, answered",
      })
    ).toHaveCount(0)
  );
  yield* activate(
    confirmation.getByRole("button", {
      exact: true,
      name: "Question 5, unanswered",
    }),
    hasTouch
  );
  yield* Effect.promise(() =>
    expect(confirmation).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() => expect(current).toHaveText("5"));
  yield* expectUncovered(
    questionHeading(page, 5),
    readinessTimeoutMilliseconds
  );

  // One question at a time shows only the question the arrows reach.
  yield* chooseView(page, hasTouch, "One question");
  yield* expectView(page, "One question");
  yield* Effect.promise(() => expect(questionArticle(page, 5)).toBeVisible());
  yield* Effect.promise(() => page.keyboard.press("ArrowRight"));
  yield* Effect.promise(() => expect(current).toHaveText("6"));
  yield* Effect.promise(() => expect(questionArticle(page, 6)).toBeVisible());
  yield* Effect.promise(() => expect(questionArticle(page, 5)).toBeHidden());
});

/**
 * Keeps the current number inside a sidebar that is shorter than its grid, so
 * a learner always sees where they are, however the current question changed.
 */
const verifyShortSidebar = Effect.fn("NakafaE2E.verifyShortSidebar")(function* (
  page: Page,
  baseURL: string
) {
  yield* runFirstSection(page, false, baseURL);
  // The questions stream in after the header, so wait for them to measure.
  yield* expectView(page, "List");
  // The window shrinks once the section runs, so the setup keeps its room.
  yield* Effect.promise(() =>
    page.setViewportSize({
      height: SHORT_WINDOW_HEIGHT,
      width: desktopViewport.width,
    })
  );
  const current = currentNumberOf(page, false);
  yield* Effect.promise(() => expect(current).toHaveText("1"));

  // The last number starts below the fold of the column.
  const total = yield* Effect.promise(() => numberCells(page).count());
  const belowFold = yield* Effect.promise(() =>
    sidebarOf(page).evaluate((column) => {
      const last = column.querySelector("li:last-child");
      return (
        (last?.getBoundingClientRect().bottom ?? 0) >
        column.getBoundingClientRect().bottom
      );
    })
  );
  yield* Effect.sync(() => expect(belowFold).toBe(true));

  // The end of the list makes the last question current, and the column
  // scrolls to its number although nobody pressed it.
  yield* scrollPageTo(page, "end");
  yield* Effect.promise(() => expect(current).toHaveText(String(total)));
  yield* expectUncovered(current, readinessTimeoutMilliseconds);

  // Back at the start, the column follows the reader up again.
  yield* scrollPageTo(page, "start");
  yield* Effect.promise(() => expect(current).toHaveText("1"));
  yield* expectUncovered(current, readinessTimeoutMilliseconds);
});

for (const viewport of tryoutViewports) {
  test.describe(`Try-out player on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("resolves its view on the server and keeps the page still when it changes", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) =>
              verifyView(page, viewport.hasTouch, origin)
            )
          )
        )
      );
    });

    test("takes a view back when the server cannot save it", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) =>
              verifyRollback(page, viewport.hasTouch, origin)
            )
          )
        )
      );
    });

    test("moves between questions with the keys and the navigator", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) =>
              verifyKeys(page, viewport.hasTouch, origin)
            )
          )
        )
      );
    });
  });
}

test.describe("Try-out player in a short window", () => {
  test.use({
    hasTouch: desktopViewport.hasTouch,
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("keeps the current number in view in a sidebar that scrolls", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyShortSidebar(page, origin))
        )
      )
    );
  });
});
