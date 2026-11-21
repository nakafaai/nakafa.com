import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { loadMathFonts } from "@/e2e/support/fonts";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { finishSection, waitForRunningSection } from "@/e2e/support/player";
import { waitForQuiet } from "@/e2e/support/quiet";
import {
  expectStillShell,
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  arrive,
  arriveLocked,
  LOCKED_SHELL,
  onPath,
  openCountry,
  openTrack,
  setHref,
  trackHref,
} from "@/e2e/support/tryout";
import { tryoutViewports } from "@/e2e/support/viewport";

/** Whether a pathname is the walked set. */
const isSet = (pathname: string) => pathname === setHref;

/** Whether a pathname is one of the walked set's sections. */
const isSection = (pathname: string) => pathname.startsWith(`${setHref}/`);

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
  const urls = MutableList.make<string>();
  const record = (frame: { url: () => string }) =>
    MutableList.append(urls, frame.url());
  page.on("framenavigated", record);
  yield* run;
  // Late streamed content would still move the page, so keep observing until it goes quiet.
  yield* Effect.promise(() => waitForQuiet(page));
  page.off("framenavigated", record);
  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => expectStillShell(observation, locks));
  return MutableList.toArray(urls);
});

/**
 * Signs a synthetic learner in and walks one attempt through the shell: start
 * it from the catalog into its first section, reload it, finish it, revisit
 * the finished section, leave for the catalog, come back through the running
 * set's row, and open the public set URL of the running attempt.
 */
const verifyAttemptShell = Effect.fn("NakafaE2E.verifyAttemptShell")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  yield* signInLearner(page.context(), baseURL);
  yield* observeShell(page);
  yield* openCountry(page);
  // The page loads again only at the reload below. The attempt starts before
  // it on this connection, and the server runs the changes of a connection in
  // the order they were sent, so it stores this choice first.
  yield* openTrack(page, hasTouch);

  // Starting from the public set locks the shell only with the attempt's first
  // section, which the start opens running. A set nobody has started opens
  // beside the track's table, where the player suites press its Start, so this
  // walk opens the set's own page by its address.
  const start = page.getByRole("button", { exact: true, name: "Start" });
  yield* Effect.promise(() => page.goto(setHref, { waitUntil: "commit" }));
  yield* arrive(page, onPath(setHref), start);
  yield* Effect.promise(() => waitForQuiet(page));
  yield* observeStep(
    page,
    [false, true],
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
      );
      yield* activate(start, hasTouch);
      yield* activate(
        page.getByRole("dialog").getByRole("button", { name: "Start free" }),
        hasTouch
      );
      yield* arriveLocked(page, isSection);
      yield* waitForRunningSection(page);
    })
  );

  const startedSection = new URL(page.url()).pathname;
  // Questions render math, whose fonts load on first use. A font swapping in
  // late moves text, which is not what this suite measures.
  yield* loadMathFonts(page);
  const finish = page.getByRole("button", { exact: true, name: "Finish" });

  // A reload paints the running section locked from its first frame.
  yield* Effect.promise(() => page.reload({ waitUntil: "commit" }));
  yield* Effect.promise(() =>
    expect(finish).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() => waitForQuiet(page));
  const reloaded = yield* readShellObservation(page, 0);
  yield* Effect.sync(() => {
    expect(reloaded.headinglessFrames).toBe(0);
    expect(reloaded.shells).toBe(1);
    expect(reloaded.layoutShifts).toEqual([]);
    expect(reloaded.locks).toEqual([true]);
    expect(reloaded.marked).toBe(false);
  });

  // Finishing the section returns to the attempt's set, still locked.
  yield* observeStep(page, [true], finishSection(page, hasTouch));
  const attemptSearch = new URL(page.url()).search;

  // A completed part of an in-progress attempt opens its info dialog right in the pane (never a card-only page),
  // and an unstarted part asks for confirmation instead of auto-starting its clock.
  // A phone shows the set's pane in a drawer, a dialog too, which says the attempt's facts as well, so each part's
  // dialog is the one dialog more than the page held before the press, and the last one open.
  const dialogs = page.getByRole("dialog");
  const pressPart = Effect.fn("NakafaE2E.pressPart")(function* (
    step: "done" | "next",
    says: (dialog: Locator) => Promise<void>
  ) {
    const before = yield* Effect.promise(() => dialogs.count());
    yield* activate(
      page.locator(`ol button[data-part-step="${step}"]`).first(),
      hasTouch
    );
    yield* Effect.promise(async () => {
      await expect(dialogs).toHaveCount(before + 1, {
        timeout: readinessTimeoutMilliseconds,
      });
      await says(dialogs.last());
      expect(new URL(page.url()).pathname).toBe(setHref);
      await page.keyboard.press("Escape");
      await expect(dialogs).toHaveCount(before, {
        timeout: readinessTimeoutMilliseconds,
      });
    });
  });
  yield* observeStep(
    page,
    [true],
    Effect.gen(function* () {
      yield* pressPart("done", (dialog) =>
        expect(
          dialog.getByText("Correct answers", { exact: true })
        ).toBeVisible()
      );
      yield* pressPart("next", (dialog) =>
        expect(
          dialog.getByRole("button", { exact: true, name: "Start" })
        ).toBeVisible()
      );
    })
  );

  // Closing the set's pane leaves for the track, which unlocks the shell together with the new page: a press on
  // the open set's row beside the table, or Escape, which closes the drawer a phone shows the pane in.
  // The running set's row in the table: every row links the set's own address, which moves to the attempt's.
  const runningRow = page
    .getByRole("table")
    .locator(`a[href="${setHref}"], a[href^="${setHref}?"]`)
    .first();
  yield* observeStep(
    page,
    [true, false],
    Effect.gen(function* () {
      if (hasTouch) {
        yield* Effect.promise(() => page.keyboard.press("Escape"));
      } else {
        yield* activate(
          page.getByRole("table").locator('a[aria-current="page"]'),
          hasTouch
        );
      }
      yield* arrive(page, onPath(trackHref), runningRow);
    })
  );

  // The running set's row opens the attempt: the track stays on screen until
  // the locked set is ready, at the attempt's address.
  const reopened = yield* observeStep(
    page,
    [false, true],
    Effect.gen(function* () {
      yield* activate(runningRow, hasTouch);
      yield* arriveLocked(page, isSet);
    })
  );
  yield* Effect.sync(() => {
    expect(reopened.length).toBeGreaterThan(0);
    expect(new URL(page.url()).searchParams.has("attemptId")).toBe(true);
  });

  // Visiting a completed section's URL directly while its set still runs redirects straight back to the set pane.
  yield* Effect.promise(() =>
    page.goto(`${startedSection}${attemptSearch}`, { waitUntil: "commit" })
  );
  yield* arriveLocked(page, isSet);
  yield* Effect.sync(() => {
    expect(new URL(page.url()).searchParams.has("attemptId")).toBe(true);
  });

  // The public set URL of a running attempt moves to the attempt's address,
  // with its heading in every frame and one change to the locked shell.
  yield* Effect.promise(() => page.goto(setHref, { waitUntil: "commit" }));
  yield* Effect.promise(() =>
    expect(page.locator(LOCKED_SHELL)).toBeAttached({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() => waitForQuiet(page));
  const direct = yield* readShellObservation(page, 0);
  yield* Effect.sync(() => {
    expect(new URL(page.url()).searchParams.has("attemptId")).toBe(true);
    expect(direct.headinglessFrames).toBe(0);
    expect(direct.shells).toBe(1);
    expect(direct.layoutShifts).toEqual([]);
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
