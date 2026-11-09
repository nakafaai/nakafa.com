import { expect, type Page, test } from "@playwright/test";
import { Deferred, Effect, Option } from "effect";
import { CONVEX_SOCKET } from "@/e2e/support/frames";
import { activate } from "@/e2e/support/input";
import { expectUncovered } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  chooseView,
  currentNumberOf,
  expectView,
  openingView,
  openSurface,
  otherView,
  questionArticle,
  questionHeading,
  readRememberedView,
  runFirstSection,
  showList,
  shownQuestions,
  sidebarOf,
  waitForRunningSection,
} from "@/e2e/support/player";
import { waitForQuiet } from "@/e2e/support/quiet";
import { SERVER_FUNCTION_PATH } from "@/e2e/support/requests";
import {
  expectStillShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { tryoutViewports } from "@/e2e/support/viewport";

/** The `view` parameter of each view. */
const VIEW_PARAMS = { List: "list", "One question": "single" } as const;

/** An address whose `view` parameter names each view. */
const VIEW_ADDRESSES = {
  List: /[?&]view=list(?:&|$)/u,
  "One question": /[?&]view=single(?:&|$)/u,
} as const;

/** What the player says while the connection is gone. */
const OFFLINE_NOTE = "Your changes save once you are back online.";

/** What the learner is told when the server cannot save the view. */
const VIEW_ERROR = "We couldn't save your view.";

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
 * Opens an address and counts the questions the player first shows once the
 * learner's attempt arrives in the browser, which resolves the view from the
 * address and the saved view before the player renders.
 */
const shownAtOpen = Effect.fn("NakafaE2E.shownAtOpen")(function* (
  page: Page,
  address: string
) {
  yield* Effect.promise(() => page.goto(address, { waitUntil: "commit" }));
  yield* waitForRunningSection(page);
  return yield* Effect.promise(() => shownQuestions(page).count());
});

/**
 * Resolves the view from the address, then the learner's saved view, then the device's own (D6): one question at a
 * time on a phone and the list anywhere wider, in the browser, and keeps the page still while the view changes and
 * the timer ticks.
 */
const verifyView = Effect.fn("NakafaE2E.verifyPlayerView")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  yield* runFirstSection(page, hasTouch, baseURL);
  const address = page.url();
  const opening = openingView(page);
  const other = otherView(opening);
  yield* expectView(page, opening);

  // With nothing saved, the device's view; the address alone names the other view.
  yield* shownAtOpen(page, withView(address));
  yield* expectView(page, opening);
  yield* shownAtOpen(page, withView(address, VIEW_PARAMS[other]));
  yield* expectView(page, other);
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
  yield* expectView(page, opening);
  yield* Effect.promise(() =>
    expect(
      page.getByRole("button", { exact: true, name: "Finish" })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  // Late streamed content would still move the page, so let it go quiet.
  yield* Effect.promise(() => waitForQuiet(page));
  // The view's button grows with its name as the press answers, which the page may do.
  yield* chooseView(page, hasTouch, other);
  const since = yield* readPageTime(page);
  yield* expectView(page, other);
  yield* expectRemembered(page, VIEW_PARAMS[other]);
  yield* Effect.promise(() => waitForQuiet(page));
  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => expectStillShell(observation, [true]));

  // The saved view is the first one after a reload, and the address still wins.
  yield* shownAtOpen(page, withView(address));
  yield* expectView(page, other);
  yield* shownAtOpen(page, withView(address, VIEW_PARAMS[opening]));
  yield* expectView(page, opening);

  // Choosing a view again keeps the address in step, so a reload cannot undo it; the fresh page goes quiet first.
  yield* Effect.promise(() => waitForQuiet(page));
  yield* chooseView(page, hasTouch, other);
  yield* Effect.promise(() =>
    expect(page).toHaveURL(VIEW_ADDRESSES[other], {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* expectView(page, other);
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
  const opening = openingView(page);
  yield* expectView(page, opening);

  const failSave = yield* Deferred.make<void>();
  const services = yield* Effect.context<never>();
  yield* Effect.promise(() =>
    page.route(
      (url) => url.pathname.startsWith(SERVER_FUNCTION_PATH),
      (route) =>
        route.request().method() === "POST"
          ? Effect.runPromiseWith(services)(
              Deferred.await(failSave).pipe(
                Effect.andThen(() => Effect.promise(() => route.abort()))
              )
            )
          : route.continue()
    )
  );

  yield* chooseView(page, hasTouch, otherView(opening));
  yield* expectView(page, otherView(opening));

  yield* Deferred.succeed(failSave, undefined);
  yield* expectView(page, opening);
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
  yield* showList(page, hasTouch);
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

  // An option keeps focus after its press, and an arrow still steps and leaves the answer as it is.
  const firstOptions = questionArticle(page, 1).getByRole("radio");
  yield* Effect.promise(() => firstOptions.nth(1).click());
  yield* Effect.promise(() => expect(firstOptions.nth(1)).toBeChecked());
  yield* Effect.promise(() => page.keyboard.press("ArrowRight"));
  yield* Effect.promise(() => expect(current).toHaveText("2"));
  yield* Effect.promise(() => expect(firstOptions.nth(1)).toBeChecked());
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

/**
 * Cuts the page's socket once the section runs, and keeps refusing the client's new ones, so the player
 * says the connection is gone until a socket opens again. The note stands beside the title on a desktop.
 */
test("says so while the connection is gone, and stops once it is back", async ({
  baseURL,
  page,
}) => {
  let down = false;
  const closeSocket: { current: (() => Promise<void>) | undefined } = {
    current: undefined,
  };
  await page.routeWebSocket(CONVEX_SOCKET, (socket) => {
    if (down) {
      socket.close();
      return;
    }
    socket.connectToServer();
    closeSocket.current = () => socket.close();
  });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* runFirstSection(page, false, origin);
        const note = page.getByText(OFFLINE_NOTE);
        yield* Effect.promise(async () => {
          await expect(note).toBeHidden();
          down = true;
          await closeSocket.current?.();
          await expect(note).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          down = false;
          await expect(note).toBeHidden({
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    )
  );
});
