import { expect, type Page } from "@playwright/test";
import { Array as Arr, Effect, Option, pipe, Schema } from "effect";
import {
  readRecordedLayoutShifts,
  recordLayoutShifts,
} from "@/e2e/support/layout";
import { TOASTER } from "@/e2e/support/selector";

const SAMPLES_KEY = "nakafaShellSamples";
const LAYOUT_SHIFTS_KEY = "nakafaLayoutShifts";

/**
 * One animation frame of the app shell, as the page recorded it. `titles` are the
 * visible `<h1>` words of its visible `<main>` elements, and `page` is what the
 * frame showed of the page: those titles, then each visible page header's words
 * and the left edge and width of the header's row, which reads the page's frame.
 */
const ShellFrame = Schema.Struct({
  locked: Schema.Boolean,
  mains: Schema.Array(Schema.Int),
  marked: Schema.Boolean,
  page: Schema.String,
  time: Schema.Finite,
  titles: Schema.Array(Schema.String),
});

/** Every animation frame the page recorded, appended to by its init script. */
const ShellSamples = Schema.Struct({
  frames: Schema.mutable(Schema.Array(ShellFrame)),
});

/** What the browser rendered of the app shell since one point in time. */
const ShellObservation = Schema.Struct({
  frames: Schema.Int,
  /** Frames whose visible `<main>` showed no page heading. */
  headinglessFrames: Schema.Int,
  /** Frames without any visible `<main>`. */
  hiddenFrames: Schema.Int,
  /**
   * One line per layout shift, shifts right after input included: its value,
   * its time, and each element that moved. A stable page has none. A shift of
   * the toasts alone is left out: they stack over the page, and when a second
   * one arrives the first animates its height to the new one's.
   */
  layoutShifts: Schema.Array(Schema.String),
  /**
   * The shell's lock state over the frames that show it, one entry per
   * change, so `[false, true]` locks once and `[true]` never shows the
   * unlocked shell.
   */
  locks: Schema.Array(Schema.Boolean),
  /**
   * Whether the last frame's document still held a lock marker. Only server
   * markup carries one, until its page hydrates.
   */
  marked: Schema.Boolean,
  /**
   * Frames whose document held a lock marker anywhere, a page the router keeps
   * hidden after navigation included, so a client navigation has none.
   */
  markedFrames: Schema.Int,
  /**
   * What the frames showed of a page before the titles of the last frame first
   * appeared, one entry per change. The page a press leaves stays whole, its
   * header and its frame included, until the next page renders, so this holds
   * one entry, or none when the titles never changed.
   */
  outgoing: Schema.Array(Schema.String),
  /** Distinct `<main>` elements seen, so a remounted shell counts twice. */
  shells: Schema.Int,
  /**
   * The titles of the frames that show the shell, one entry per change. A press
   * shows at most two, the page it leaves and the page it opens, so a third is a
   * frame that named neither, such as a page under a second header.
   */
  titles: Schema.Array(Schema.String),
});

/**
 * Records, from the first script on, every animation frame's visible `<main>`
 * elements by identity, the titles and the page header they show, and whether
 * the shell is locked. Layout shifts go to `recordLayoutShifts`. The script
 * runs in the page, so it uses the browser's own APIs.
 */
export const observeShell = Effect.fn("NakafaE2E.observeShell")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.addInitScript((key) => {
      const samples: typeof ShellSamples.Type = { frames: [] };
      Object.defineProperty(window, key, { value: samples });
      const identities = new WeakMap<Element, number>();
      let nextIdentity = 1;
      const identify = (element: Element) => {
        const known = identities.get(element);
        if (known !== undefined) {
          return known;
        }
        identities.set(element, nextIdentity);
        nextIdentity += 1;
        return nextIdentity - 1;
      };
      const visibility = { checkOpacity: true, checkVisibilityCSS: true };
      // What the frame draws of an element: its rendered text, without the
      // text of the inline scripts a server page carries until it hydrates.
      const words = (element: Element) =>
        (element instanceof HTMLElement ? element.innerText : "")
          .replace(/\s+/gu, " ")
          .trim();
      // A page's own `<main>` can stand inside the shell's, so each element counts once.
      const shown = (mains: readonly Element[], selector: string) => [
        ...new Set(
          mains.flatMap((main) =>
            [...main.querySelectorAll(selector)].filter((element) =>
              element.checkVisibility(visibility)
            )
          )
        ),
      ];
      const sample = () => {
        const mains = [...document.querySelectorAll("main")].filter((main) =>
          main.checkVisibility(visibility)
        );
        const titles = shown(mains, "h1").map(words);
        // The header's last child is its row, which stands on the page's frame.
        const headers = shown(mains, '[data-slot="page-header"]').map(
          (header) => {
            const row = header.lastElementChild?.getBoundingClientRect();
            return `${words(header)} @ ${Math.round(row?.left ?? 0)}+${Math.round(row?.width ?? 0)}`;
          }
        );
        samples.frames.push({
          // Exactly what the shell's styles read on its wrapper: its
          // `data-locked` attribute, or the server marker inside it before
          // hydration. A streamed marker still parked outside the wrapper
          // locks nothing yet.
          locked:
            document
              .querySelector("[data-slot=sidebar-wrapper]")
              ?.matches("[data-locked], :has([data-shell-lock])") ?? false,
          mains: mains.map(identify),
          marked: document.querySelector("[data-shell-lock]") !== null,
          page: [titles.join(" | "), ...headers].join("\n"),
          time: performance.now(),
          titles,
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, SAMPLES_KEY)
  );
  yield* Effect.promise(() =>
    page.addInitScript(recordLayoutShifts, {
      key: LAYOUT_SHIFTS_KEY,
      overlay: TOASTER,
    })
  );
});

/** Reads the page clock, to start an observation window from now. */
export const readPageTime = Effect.fn("NakafaE2E.readPageTime")(function* (
  page: Page
) {
  return yield* Effect.promise(() => page.evaluate(() => performance.now()));
});

/** Whether a frame shows any `<main>` at all. */
const showsShell = (frame: typeof ShellFrame.Type) =>
  Arr.isReadonlyArrayNonEmpty(frame.mains);

/** The titles of one frame, in one line. */
const titlesOf = (frame: typeof ShellFrame.Type) =>
  Arr.join(frame.titles, " | ");

/**
 * What the shell frames showed of a page until the last frame's titles first
 * appeared, one entry per change.
 */
function outgoingPages(frames: readonly (typeof ShellFrame.Type)[]) {
  const opened = Arr.last(frames).pipe(
    Option.flatMap((last) =>
      Arr.findFirstIndex(frames, (frame) => titlesOf(frame) === titlesOf(last))
    ),
    Option.getOrElse(() => 0)
  );
  return pipe(
    Arr.take(frames, opened),
    Arr.map((frame) => frame.page),
    Arr.dedupeAdjacent
  );
}

/**
 * Expects the frames since one observation to show the app shell throughout: a
 * mounted, visible shell with a heading in every frame, no layout shift, and
 * exactly the expected lock states. A client render locks through the shell
 * alone, so no page, hidden or not, may carry the server's lock marker. A move
 * within one shell keeps its `<main>`; a move to the other shell, from the app to
 * the marketing pages or back, swaps it once, in one frame, so it shows two.
 */
export function expectStillShell(
  observation: typeof ShellObservation.Type,
  locks: readonly boolean[],
  shells = 1
) {
  expect(observation.frames).toBeGreaterThan(0);
  expect(observation.hiddenFrames).toBe(0);
  expect(observation.headinglessFrames).toBe(0);
  expect(observation.shells).toBe(shells);
  expect(observation.layoutShifts).toEqual([]);
  expect(observation.locks).toEqual(locks);
  expect(observation.markedFrames).toBe(0);
}

/**
 * Expects the frames of one press to hold `expectStillShell` and to show two
 * pages at most: every frame keeps the page the press leaves whole, its titles,
 * header and frame included, until the next page renders in its place, and no
 * frame shows a third page, such as a page under a second header. A journey of
 * many presses observed at once holds `expectStillShell` alone.
 */
export function expectOnePress(
  observation: typeof ShellObservation.Type,
  locks: readonly boolean[],
  shells = 1
) {
  expectStillShell(observation, locks, shells);
  expect(Arr.drop(observation.outgoing, 1)).toEqual([]);
  expect(Arr.drop(observation.titles, 2)).toEqual([]);
}

/** Summarizes the frames and layout shifts recorded since `since`. */
export const readShellObservation = Effect.fn("NakafaE2E.readShellObservation")(
  function* (page: Page, since: number) {
    const samples = yield* Effect.promise(() =>
      page.evaluate((key) => Reflect.get(window, key), SAMPLES_KEY)
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(ShellSamples)));
    const shifts = yield* readRecordedLayoutShifts(page, LAYOUT_SHIFTS_KEY);
    const frames = Arr.filter(samples.frames, (frame) => frame.time >= since);
    const shellFrames = Arr.filter(frames, showsShell);
    return ShellObservation.make({
      frames: frames.length,
      headinglessFrames: Arr.countBy(shellFrames, (frame) =>
        Arr.isReadonlyArrayEmpty(frame.titles)
      ),
      hiddenFrames: Arr.countBy(frames, (frame) => !showsShell(frame)),
      layoutShifts: pipe(
        shifts,
        Arr.filter((shift) => shift.time >= since),
        Arr.map(
          (shift) =>
            `${shift.value} at ${Math.round(shift.time)} ms: ${Arr.join(shift.sources, "; ")}`
        )
      ),
      locks: pipe(
        shellFrames,
        Arr.map((frame) => frame.locked),
        Arr.dedupeAdjacent
      ),
      marked: Arr.last(frames).pipe(Option.exists((frame) => frame.marked)),
      markedFrames: Arr.countBy(frames, (frame) => frame.marked),
      outgoing: outgoingPages(shellFrames),
      shells: pipe(
        frames,
        Arr.flatMap((frame) => frame.mains),
        Arr.dedupe
      ).length,
      titles: pipe(shellFrames, Arr.map(titlesOf), Arr.dedupeAdjacent),
    });
  }
);

/** Waits until the page has drawn `count` more animation frames. */
const waitFrames = (page: Page, count: number) =>
  Effect.promise(() =>
    page.evaluate(
      (frames) =>
        new Promise<void>((resolve) => {
          let left = frames;
          const tick = () => {
            left -= 1;
            if (left > 0) {
              requestAnimationFrame(tick);
              return;
            }
            resolve();
          };
          requestAnimationFrame(tick);
        }),
      count
    )
  );

/**
 * Runs a press, waits through `arrive` for the page it opens, and expects the
 * contract of `expectOnePress` from the press on. The recorder of
 * `observeShell` must run.
 */
export const expectPressKeepsPage = Effect.fn("NakafaE2E.expectPressKeepsPage")(
  function* <PressError, PressRequirements, ArriveError, ArriveRequirements>(
    page: Page,
    press: Effect.Effect<void, PressError, PressRequirements>,
    arrive: Effect.Effect<void, ArriveError, ArriveRequirements>
  ) {
    const since = yield* readPageTime(page);
    yield* press;
    yield* arrive;
    // Frames after the next page renders, where a page left behind would show.
    yield* waitFrames(page, 10);
    const observation = yield* readShellObservation(page, since);
    yield* Effect.sync(() => expectOnePress(observation, [false]));
  }
);
