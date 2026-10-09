import { expect, type Page } from "@playwright/test";
import { Array as Arr, Effect, Option, pipe, Schema } from "effect";
import { recordLayoutShifts } from "@/e2e/support/layout";

const SAMPLES_KEY = "nakafaShellSamples";
const LAYOUT_SHIFTS_KEY = "nakafaLayoutShifts";

/** One animation frame of the app shell, as the page recorded it. */
const ShellFrame = Schema.Struct({
  heading: Schema.Boolean,
  locked: Schema.Boolean,
  mains: Schema.Array(Schema.Int),
  marked: Schema.Boolean,
  time: Schema.Finite,
});

/** Every animation frame the page recorded, appended to by its init script. */
const ShellSamples = Schema.Struct({
  frames: Schema.mutable(Schema.Array(ShellFrame)),
});

/** The layout shifts the page recorded, each with the time it started and what moved. */
const RecordedShifts = Schema.Array(
  Schema.Struct({
    sources: Schema.Array(Schema.String),
    time: Schema.Finite,
    value: Schema.Finite,
  })
);

/** What the browser rendered of the app shell since one point in time. */
const ShellObservation = Schema.Struct({
  frames: Schema.Int,
  /** Frames whose visible `<main>` showed no page heading. */
  headinglessFrames: Schema.Int,
  /** Frames without any visible `<main>`. */
  hiddenFrames: Schema.Int,
  /**
   * One line per layout shift, shifts right after input included: its value,
   * its time, and each element that moved. A stable page has none.
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
   * Frames whose document held a lock marker anywhere, a page Next.js keeps
   * hidden after navigation included, so a client navigation has none.
   */
  markedFrames: Schema.Int,
  /** Distinct `<main>` elements seen, so a remounted shell counts twice. */
  shells: Schema.Int,
});

/**
 * Records, from the first script on, every animation frame's visible `<main>`
 * elements by identity, whether the page inside shows a heading, and whether
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
      const sample = () => {
        const mains = [...document.querySelectorAll("main")].filter((main) =>
          main.checkVisibility(visibility)
        );
        samples.frames.push({
          heading: mains.some((main) =>
            [...main.querySelectorAll("h1")].some((heading) =>
              heading.checkVisibility(visibility)
            )
          ),
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
          time: performance.now(),
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, SAMPLES_KEY)
  );
  yield* Effect.promise(() =>
    page.addInitScript(recordLayoutShifts, LAYOUT_SHIFTS_KEY)
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

/**
 * Expects the frames since one observation to show the app shell throughout: a
 * mounted, visible shell with a heading in every frame, no layout shift, and
 * exactly the expected lock states. A client render locks through the shell
 * alone, so no page, hidden or not, may carry the server's lock marker.
 */
export function expectStillShell(
  observation: typeof ShellObservation.Type,
  locks: readonly boolean[]
) {
  expect(observation.frames).toBeGreaterThan(0);
  expect(observation.hiddenFrames).toBe(0);
  expect(observation.headinglessFrames).toBe(0);
  expect(observation.shells).toBe(1);
  expect(observation.layoutShifts).toEqual([]);
  expect(observation.locks).toEqual(locks);
  expect(observation.markedFrames).toBe(0);
}

/** Summarizes the frames and layout shifts recorded since `since`. */
export const readShellObservation = Effect.fn("NakafaE2E.readShellObservation")(
  function* (page: Page, since: number) {
    const samples = yield* Effect.promise(() =>
      page.evaluate((key) => Reflect.get(window, key), SAMPLES_KEY)
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(ShellSamples)));
    const shifts = yield* Effect.promise(() =>
      page.evaluate((key) => Reflect.get(window, key), LAYOUT_SHIFTS_KEY)
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(RecordedShifts)));
    const frames = Arr.filter(samples.frames, (frame) => frame.time >= since);
    return ShellObservation.make({
      frames: frames.length,
      headinglessFrames: Arr.countBy(
        frames,
        (frame) => showsShell(frame) && !frame.heading
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
        frames,
        Arr.filter(showsShell),
        Arr.map((frame) => frame.locked),
        Arr.dedupeAdjacent
      ),
      marked: Arr.last(frames).pipe(Option.exists((frame) => frame.marked)),
      markedFrames: Arr.countBy(frames, (frame) => frame.marked),
      shells: pipe(
        frames,
        Arr.flatMap((frame) => frame.mains),
        Arr.dedupe
      ).length,
    });
  }
);
