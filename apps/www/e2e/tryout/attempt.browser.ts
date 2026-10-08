import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/context";
import { visibleLink } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import {
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  activate,
  arrive,
  openHub,
  openTrack,
  setHref,
  trackHref,
} from "@/e2e/support/tryout";
import { tryoutViewports } from "@/e2e/support/viewport";

/** The shell's lock attribute, which the lock store sets once a page hydrates. */
const LOCKED_SHELL = "[data-slot=sidebar-wrapper][data-locked]";

/** Whether a pathname is the walked set. */
const isSet = (pathname: string) => pathname === setHref;

/** Whether a pathname is one of the walked set's sections. */
const isSection = (pathname: string) => pathname.startsWith(`${setHref}/`);

/** Waits until the browser shows a page of an attempt, with the shell locked. */
const arriveLocked = Effect.fn("NakafaE2E.arriveAtLockedAttempt")(function* (
  page: Page,
  matches: (pathname: string) => boolean
) {
  yield* Effect.promise(() =>
    expect(page).toHaveURL(
      (url) => matches(url.pathname) && url.searchParams.has("attemptId"),
      { timeout: readinessTimeoutMilliseconds }
    )
  );
  yield* Effect.promise(() =>
    expect(page.locator(LOCKED_SHELL)).toBeAttached({
      timeout: readinessTimeoutMilliseconds,
    })
  );
});

/**
 * Runs one navigation step while recording every frame, then requires a
 * mounted shell with a heading in every frame, no layout shift, and exactly
 * the expected lock states, so a locked flow never flashes the unlocked shell.
 */
const observeStep = Effect.fn("NakafaE2E.observeAttemptStep")(function* (
  page: Page,
  locks: readonly boolean[],
  run: Effect.Effect<void>
) {
  const since = yield* readPageTime(page);
  const urls: string[] = [];
  const record = (frame: { url: () => string }) => urls.push(frame.url());
  page.on("framenavigated", record);
  yield* run;
  // Late streamed content would still move the page, so keep observing.
  yield* Effect.sleep("750 millis");
  page.off("framenavigated", record);
  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => {
    expect(observation.frames).toBeGreaterThan(0);
    expect(observation.hiddenFrames).toBe(0);
    expect(observation.headinglessFrames).toBe(0);
    expect(observation.shells).toBe(1);
    expect(observation.layoutShift).toBe(0);
    expect(observation.locks).toEqual(locks);
    // A client render locks through the shell alone, so no page, hidden or
    // not, may carry the server's lock marker.
    expect(observation.markedFrames).toBe(0);
  });
  return urls;
});

/**
 * Signs a synthetic learner in and walks one attempt through the shell: start
 * it from the catalog, run its first section, reload it, finish it, revisit
 * the finished section, leave for the catalog, come back through the running
 * set's row, and open the public set URL of the running attempt.
 */
const verifyAttemptShell = Effect.fn("NakafaE2E.verifyAttemptShell")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* observeShell(page);
  yield* openHub(page);
  // A signed-in learner decides analytics once for the account.
  const decline = page.getByRole("button", { exact: true, name: "Decline" });
  yield* activate(decline, hasTouch);
  yield* Effect.promise(() =>
    expect(decline).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );
  yield* openTrack(page, hasTouch);

  // Starting from the public set locks the shell only with the attempt's
  // first section.
  const start = page.getByRole("button", { exact: true, name: "Start" });
  yield* observeStep(
    page,
    [false, true],
    Effect.gen(function* () {
      yield* activate(visibleLink(page, setHref), hasTouch);
      yield* arrive(page, setHref, start);
      yield* Effect.promise(() =>
        expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
      );
      yield* activate(start, hasTouch);
      yield* activate(
        page.getByRole("dialog").getByRole("button", { name: "Start free" }),
        hasTouch
      );
      yield* arriveLocked(page, isSection);
    })
  );

  const startedSection = new URL(page.url()).pathname;
  // Questions render math, whose fonts load on first use. A font swapping in
  // late moves text, which is not what this suite measures.
  yield* Effect.promise(() =>
    page.evaluate(() =>
      Promise.all(
        [...document.fonts]
          .filter((face) => face.family.startsWith("KaTeX"))
          .map((face) => face.load())
      ).then(() => undefined)
    )
  );

  // Running the section keeps the same locked page.
  const finish = page.getByRole("button", { exact: true, name: "Finish" });
  yield* observeStep(
    page,
    [true],
    Effect.gen(function* () {
      yield* activate(start, hasTouch);
      yield* Effect.promise(() =>
        expect(finish).toBeVisible({ timeout: readinessTimeoutMilliseconds })
      );
    })
  );

  // A reload paints the running section locked from its first frame.
  yield* Effect.promise(() => page.reload({ waitUntil: "commit" }));
  yield* Effect.promise(() =>
    expect(finish).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.sleep("750 millis");
  const reloaded = yield* readShellObservation(page, 0);
  yield* Effect.sync(() => {
    expect(reloaded.headinglessFrames).toBe(0);
    expect(reloaded.shells).toBe(1);
    expect(reloaded.layoutShift).toBe(0);
    expect(reloaded.locks).toEqual([true]);
    expect(reloaded.marked).toBe(false);
  });

  // Finishing the section returns to the attempt's set, still locked.
  yield* observeStep(
    page,
    [true],
    Effect.gen(function* () {
      yield* activate(finish, hasTouch);
      yield* activate(
        page
          .getByRole("dialog")
          .getByRole("button", { exact: true, name: "Finish" }),
        hasTouch
      );
      yield* arriveLocked(page, isSet);
    })
  );

  // The finished section links back to its own attempt's set, so going
  // there and back never passes the public set.
  const back = page.getByRole("link", { exact: true, name: "Back" });
  const revisited = yield* observeStep(
    page,
    [true],
    Effect.gen(function* () {
      yield* activate(
        page.locator(`main a[href^="${startedSection}?"]`).first(),
        hasTouch
      );
      yield* arriveLocked(page, (pathname) => pathname === startedSection);
      yield* activate(back, hasTouch);
      yield* arriveLocked(page, isSet);
    })
  );

  // Leaving for the catalog unlocks the shell together with the new page.
  const runningRow = page.locator(`main a[href^="${setHref}?"]`).first();
  yield* observeStep(
    page,
    [true, false],
    Effect.gen(function* () {
      yield* activate(visibleLink(page, trackHref), hasTouch);
      yield* arrive(page, trackHref, runningRow);
    })
  );

  // The running set's row opens the attempt directly: the track stays on
  // screen until the locked set is ready.
  const reopened = yield* observeStep(
    page,
    [false, true],
    Effect.gen(function* () {
      yield* activate(runningRow, hasTouch);
      yield* arriveLocked(page, isSet);
    })
  );
  yield* Effect.sync(() => {
    for (const url of [...revisited, ...reopened]) {
      expect(new URL(url).searchParams.has("attemptId")).toBe(true);
    }
  });

  // The public set URL of a running attempt shows that attempt in place,
  // with its heading in every frame and one change to the locked shell.
  yield* Effect.promise(() => page.goto(setHref, { waitUntil: "commit" }));
  yield* Effect.promise(() =>
    expect(page.locator(LOCKED_SHELL)).toBeAttached({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.sleep("750 millis");
  const direct = yield* readShellObservation(page, 0);
  yield* Effect.sync(() => {
    expect(new URL(page.url()).search).toBe("");
    expect(direct.headinglessFrames).toBe(0);
    expect(direct.shells).toBe(1);
    expect(direct.layoutShift).toBe(0);
    expect(direct.marked).toBe(false);
    // Locked from the first painted frame, or after the catalog view once.
    expect([[true], [false, true]]).toContainEqual(direct.locks);
  });
});

for (const viewport of tryoutViewports) {
  test.describe(`Try-out attempt shell on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("locks and unlocks with the attempt's pages and never blanks", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) =>
              verifyAttemptShell(page, viewport.hasTouch, origin)
            )
          )
        )
      );
    });
  });
}
