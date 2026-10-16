import { expect, type Locator, type Page } from "@playwright/test";
import { Array as Arr, Effect, Option } from "effect";
import { pressDecline, seedAnalyticsConsent } from "@/e2e/support/consent";
import { loadMathFonts } from "@/e2e/support/fonts";
import { activate, visibleLink } from "@/e2e/support/input";
import { waitForSlide } from "@/e2e/support/layout";
import { signInLearner } from "@/e2e/support/learner";
import { observeShell } from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  arrive,
  LOCKED_SHELL,
  onPath,
  openHub,
  openTrack,
  setHref,
} from "@/e2e/support/tryout";

/** The article of every question the player has mounted, shown or not. */
const ARTICLE = "article[data-player-key]";

/** The accessible name of the footer button that opens the navigator sheet. */
const OPENER_NAME = /^Open the question navigator/;

/** The cookie in which the server remembers the view a learner chose. */
const VIEW_COOKIE = "player_view";

/** The two views the player has, named as the learner reads them. */
type PlayerView = "List" | "One question";

/**
 * The view the server remembers for the learner, when it remembers one. A
 * Promise, because a poll that waits for the server to store it needs one.
 */
export async function readRememberedView(page: Page) {
  const cookies = await page.context().cookies();
  return Option.map(
    Arr.findFirst(cookies, (cookie) => cookie.name === VIEW_COOKIE),
    (cookie) => cookie.value
  );
}

/** The questions a learner can see: the list shows all of them, one at a time shows one. */
export const shownQuestions = (page: Page) =>
  page.locator(ARTICLE).filter({ visible: true });

/** The article of one question, by its number. */
export const questionArticle = (page: Page, number: number) =>
  page.locator(`#exercise-question-${number}`);

/** The number row of one question, which a reader sees under the header when it is revealed. */
export const questionHeading = (page: Page, number: number) =>
  page.locator(`#question-${number}`);

/** The navigator column that the large breakpoint shows beside the questions. */
export const sidebarOf = (page: Page) => page.locator("[data-player-sidebar]");

/** The button in the footer that opens the navigator sheet and names the current question. */
const openerOf = (page: Page) =>
  page.getByRole("button", { name: OPENER_NAME });

/**
 * Where a reader sees which question is current: the marked number of the
 * sidebar from the large breakpoint, and the number on the footer button below
 * it.
 */
export const currentNumberOf = (page: Page, hasTouch: boolean) =>
  hasTouch ? openerOf(page) : sidebarOf(page).locator('[aria-current="step"]');

/** The sheet or dialog that is open. */
export const openSurface = (page: Page) => page.getByRole("dialog");

/** The numbers of the navigator column, one for each question of the section. */
export const numberCells = (page: Page) => sidebarOf(page).locator("li");

/**
 * Scrolls the page to its start or its end in one step, as a reader who drags
 * the scrollbar does: the page gets a scroll and no wheel, touch, or key.
 */
export const scrollPageTo = Effect.fn("NakafaE2E.scrollPageTo")(function* (
  page: Page,
  edge: "end" | "start"
) {
  yield* Effect.promise(() =>
    page.evaluate((target) => {
      window.scrollTo({
        behavior: "instant",
        top: target === "end" ? document.documentElement.scrollHeight : 0,
      });
    }, edge)
  );
});

/**
 * Scrolls the page, as a script does, until a question starts 30 px below the
 * top of the window. That is above any reading line, so the line falls inside
 * the question whatever the size of the text.
 */
export const scrollToQuestion = Effect.fn("NakafaE2E.scrollToQuestion")(
  function* (page: Page, number: number) {
    yield* Effect.promise(() =>
      questionArticle(page, number).evaluate((article) => {
        window.scrollTo({
          behavior: "instant",
          top: article.getBoundingClientRect().top + window.scrollY - 30,
        });
      })
    );
  }
);

/**
 * Scrolls the page by a few pixels, in one step and without a wheel, a touch,
 * or a key, as a reader who drags the scrollbar does.
 */
export const scrollPageBy = Effect.fn("NakafaE2E.scrollPageBy")(function* (
  page: Page,
  pixels: number
) {
  yield* Effect.promise(() =>
    page.evaluate((top) => {
      window.scrollBy({ behavior: "instant", top });
    }, pixels)
  );
});

/**
 * Waits until the browser has reported what the page's observers saw after a
 * change. An observer reports in a task after the frame that found the change,
 * so a check that a number stayed put looks only a few frames later.
 */
export const waitForObservers = Effect.fn("NakafaE2E.waitForObservers")(
  function* (page: Page) {
    yield* Effect.promise(() =>
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve())
              )
            );
          })
      )
    );
  }
);

/**
 * Signs a new learner in, starts the first set, and runs its first section:
 * the page of a running attempt, with the player in its view.
 */
export const runFirstSection = Effect.fn("NakafaE2E.runFirstSection")(
  function* (page: Page, hasTouch: boolean, baseURL: string) {
    yield* seedAnalyticsConsent(page, "denied");
    yield* signInLearner(page.context(), baseURL);
    yield* observeShell(page);
    yield* openHub(page);
    yield* pressDecline(page, hasTouch);
    yield* openTrack(page, hasTouch);

    const start = page.getByRole("button", { exact: true, name: "Start" });
    yield* activate(visibleLink(page, setHref, "main"), hasTouch);
    yield* arrive(page, onPath(setHref), start);
    yield* Effect.promise(() =>
      expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
    );
    yield* activate(start, hasTouch);
    yield* activate(
      page.getByRole("dialog").getByRole("button", { name: "Start free" }),
      hasTouch
    );
    yield* arrive(
      page,
      (url) =>
        url.pathname.startsWith(`${setHref}/`) &&
        url.searchParams.has("attemptId"),
      page.locator(LOCKED_SHELL),
      "attached"
    );
    // Questions render math, whose fonts load on first use. A font swapping in
    // late moves text, which is not what these suites measure.
    yield* loadMathFonts(page);
    yield* activate(start, hasTouch);
    yield* Effect.promise(() =>
      expect(
        page.getByRole("button", { exact: true, name: "Finish" })
      ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
    );
    // Late streamed content would still move the page, so let it settle.
    yield* Effect.sleep("750 millis");
  }
);

/**
 * Finishes the running section, then waits until the attempt's set shows again,
 * still locked, so the server has stored the finish before the page moves on.
 */
export const finishSection = Effect.fn("NakafaE2E.finishTryoutSection")(
  function* (page: Page, hasTouch: boolean) {
    yield* activate(
      page.getByRole("button", { exact: true, name: "Finish" }),
      hasTouch
    );
    yield* activate(
      page
        .getByRole("dialog")
        .getByRole("button", { exact: true, name: "Finish" }),
      hasTouch
    );
    yield* arrive(
      page,
      (url) => onPath(setHref)(url) && url.searchParams.has("attemptId"),
      page.locator(LOCKED_SHELL),
      "attached"
    );
  }
);

/** Opens the navigator sheet below the large breakpoint and waits for it to settle. */
const openNavigatorSheet = Effect.fn("NakafaE2E.openNavigatorSheet")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* activate(openerOf(page), hasTouch);
  const sheet = openSurface(page);
  yield* Effect.promise(() =>
    expect(sheet).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* waitForSlide(sheet);
  return sheet;
});

/**
 * Switches the player to one of its views from the navigator: the sidebar from
 * the large breakpoint, and the sheet below it, which closes itself once the
 * view has changed.
 */
export const chooseView = Effect.fn("NakafaE2E.chooseView")(function* (
  page: Page,
  hasTouch: boolean,
  view: PlayerView
) {
  const scope: Locator = hasTouch
    ? yield* openNavigatorSheet(page, hasTouch)
    : sidebarOf(page);
  yield* activate(
    scope.getByRole("button", { exact: true, name: view }),
    hasTouch
  );
  if (hasTouch) {
    yield* Effect.promise(() =>
      expect(openSurface(page)).toBeHidden({
        timeout: readinessTimeoutMilliseconds,
      })
    );
  }
});

/**
 * Expects the player to show a view: the list shows several questions, and one
 * at a time shows one.
 */
export const expectView = Effect.fn("NakafaE2E.expectPlayerView")(function* (
  page: Page,
  view: PlayerView
) {
  if (view === "One question") {
    yield* Effect.promise(() =>
      expect(shownQuestions(page)).toHaveCount(1, {
        timeout: readinessTimeoutMilliseconds,
      })
    );
    return;
  }
  yield* Effect.promise(() =>
    expect
      .poll(() => shownQuestions(page).count(), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBeGreaterThan(1)
  );
});

/**
 * Counts the questions the server sent in the document itself, before any
 * script ran: the player resolves its view on the server, so the list sends
 * several and one at a time sends one.
 */
export const countSentQuestions = Effect.fn("NakafaE2E.countSentQuestions")(
  function* (response: { text: () => Promise<string> } | null) {
    const html = yield* Effect.promise(
      () => response?.text() ?? Promise.resolve("")
    );
    return html.split('data-player-key="').length - 1;
  }
);
