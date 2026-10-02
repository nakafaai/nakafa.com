import type { Page } from "@playwright/test";
import { Effect, Schema } from "effect";

const SAMPLES_KEY = "nakafaShellSamples";

const ShellSamples = Schema.Struct({
  frames: Schema.Array(
    Schema.Struct({
      heading: Schema.Boolean,
      locked: Schema.Boolean,
      mains: Schema.Array(Schema.Finite),
      time: Schema.Finite,
    })
  ),
  shifts: Schema.Array(
    Schema.Struct({
      time: Schema.Finite,
      value: Schema.Finite,
    })
  ),
});

/** What the browser rendered of the app shell since one point in time. */
export interface ShellObservation {
  readonly frames: number;
  /** Frames whose visible `<main>` showed no page heading. */
  readonly headinglessFrames: number;
  /** Frames without any visible `<main>`. */
  readonly hiddenFrames: number;
  /** Summed layout shift, including shifts right after input. */
  readonly layoutShift: number;
  /**
   * The shell's lock state over the frames that show it, one entry per
   * change, so `[false, true]` locks once and `[true]` never shows the
   * unlocked shell.
   */
  readonly locks: readonly boolean[];
  /** Distinct `<main>` elements seen, so a remounted shell counts twice. */
  readonly shells: number;
}

/**
 * Records, from the first script on, every animation frame's visible `<main>`
 * elements by identity, whether the page inside shows a heading, and whether
 * the shell is locked, and every layout shift the browser reports.
 */
export const observeShell = Effect.fn("NakafaE2E.observeShell")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.addInitScript((key) => {
      const samples: {
        frames: {
          heading: boolean;
          locked: boolean;
          mains: number[];
          time: number;
        }[];
        shifts: { time: number; value: number }[];
      } = { frames: [], shifts: [] };
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
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ("value" in entry && typeof entry.value === "number") {
            samples.shifts.push({ time: entry.startTime, value: entry.value });
          }
        }
      }).observe({ buffered: true, type: "layout-shift" });
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
          // The same state the shell's styles read: the lock store's attribute
          // after hydration, the server marker before it.
          locked:
            document.querySelector(
              "[data-slot=sidebar-wrapper][data-locked], [data-shell-lock]"
            ) !== null,
          mains: mains.map(identify),
          time: performance.now(),
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, SAMPLES_KEY)
  );
});

/** Reads the page clock, to start an observation window from now. */
export const readPageTime = Effect.fn("NakafaE2E.readPageTime")(function* (
  page: Page
) {
  return yield* Effect.promise(() => page.evaluate(() => performance.now()));
});

/** Compresses the lock state of the frames that show the shell into its runs. */
function readLockRuns(
  frames: readonly {
    readonly locked: boolean;
    readonly mains: readonly number[];
  }[]
) {
  const runs: boolean[] = [];
  for (const frame of frames) {
    if (frame.mains.length > 0 && runs.at(-1) !== frame.locked) {
      runs.push(frame.locked);
    }
  }
  return runs;
}

/** Summarizes the frames and layout shifts recorded since `since`. */
export const readShellObservation = Effect.fn("NakafaE2E.readShellObservation")(
  function* (page: Page, since: number) {
    const samples = yield* Effect.promise(() =>
      page.evaluate((key) => Reflect.get(window, key), SAMPLES_KEY)
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(ShellSamples)));
    const frames = samples.frames.filter((frame) => frame.time >= since);
    return {
      frames: frames.length,
      headinglessFrames: frames.filter(
        (frame) => frame.mains.length > 0 && !frame.heading
      ).length,
      hiddenFrames: frames.filter((frame) => frame.mains.length === 0).length,
      layoutShift: samples.shifts
        .filter((shift) => shift.time >= since)
        .reduce((total, shift) => total + shift.value, 0),
      locks: readLockRuns(frames),
      shells: new Set(frames.flatMap((frame) => frame.mains)).size,
    } satisfies ShellObservation;
  }
);
