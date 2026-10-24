import type { Page } from "@playwright/test";
import { Array as Arr, Option, Schema } from "effect";

/** The page global that holds the samples of one recording. */
const PAINTS = "nakafaPaints";

/** The controls a popup or a page holds, which a reader can press, type into or pick. */
const CONTROLS =
  'button, a, input, textarea, [role="menuitem"], [role="switch"], [role="option"]';

/**
 * One animation frame the recorder sampled. `height` is the layout height of the
 * element, which a transform such as the open animation's scale does not change,
 * `controls` counts the controls it holds, `text` the length of its text, and
 * `shown` says whether a reader can see it in that frame.
 */
const PaintSample = Schema.Struct({
  at: Schema.Finite,
  controls: Schema.Finite,
  height: Schema.Finite,
  shown: Schema.Boolean,
  text: Schema.Finite,
});

/** One frame the recorder sampled. */
type PaintSample = typeof PaintSample.Type;

/**
 * Starts sampling, in every animation frame for `duration` milliseconds, the first
 * element that `selector` matches and that holds `contains`. The sampler runs in
 * the page, so it counts a frame that no step of the test waits for, and the
 * samples are kept until they are read. A frame in which the element is missing
 * samples zero everywhere, so a page that loses the element shows in the samples.
 */
export const recordPaints = (
  page: Page,
  {
    contains,
    duration,
    selector,
  }: {
    contains: string;
    duration: number;
    selector: string;
  }
) =>
  page.evaluate(
    ({ controlQuery, key, needle, query, span }) => {
      const samples: {
        at: number;
        controls: number;
        height: number;
        shown: boolean;
        text: number;
      }[] = [];
      Reflect.set(window, key, samples);
      const start = performance.now();
      const sample = (now: number) => {
        const matches = [
          ...document.querySelectorAll<HTMLElement>(query),
        ].filter((candidate) => (candidate.textContent ?? "").includes(needle));
        // A shown match is the one a reader sees, so a hidden twin never stands in for it.
        const element =
          matches.find((candidate) => candidate.checkVisibility()) ??
          matches[0];
        samples.push({
          at: now - start,
          controls: element?.querySelectorAll(controlQuery).length ?? 0,
          height: element?.offsetHeight ?? 0,
          shown:
            element?.checkVisibility({ checkVisibilityCSS: true }) ?? false,
          text: element?.textContent?.length ?? 0,
        });
        if (now - start < span) {
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    },
    {
      controlQuery: CONTROLS,
      key: PAINTS,
      needle: contains,
      query: selector,
      span: duration,
    }
  );

/** The samples that `recordPaints` took, in the order the frames ran. */
export const readPaints = async (page: Page) =>
  Schema.decodeUnknownSync(Schema.Array(PaintSample))(
    await page.evaluate((key) => Reflect.get(window, key), PAINTS)
  );

/**
 * The moment, in milliseconds since the recording started, of the last frame that
 * the recorder sampled. Zero when it sampled none.
 */
export const recordedMilliseconds = async (page: Page) =>
  Option.getOrElse(
    Option.map(Arr.last(await readPaints(page)), (sample) => sample.at),
    () => 0
  );

/**
 * What a recording says about the first frame a reader could see the element in,
 * against the frame the recording ends on. `drift` is the largest change in
 * height that a shown frame after the first one makes, in pixels. A recording
 * that never showed the element has no first frame.
 */
export function summarizePaints(samples: readonly PaintSample[]) {
  const first = Arr.findFirst(samples, (sample) => sample.shown);
  const last = Arr.last(samples);
  if (Option.isNone(first) || Option.isNone(last)) {
    return;
  }
  const {
    at: firstAt,
    controls: firstControls,
    height: firstHeight,
  } = first.value;
  const drift = Arr.reduce(
    Arr.filter(samples, (sample) => sample.shown && sample.at >= firstAt),
    0,
    (largest, sample) =>
      Math.max(largest, Math.abs(sample.height - firstHeight))
  );
  return {
    drift,
    /** Frames, from the first sample on, in which the element held no text at all: a reader sees a blank. */
    emptyFrames: Arr.filter(samples, (sample) => sample.text === 0).length,
    finalControls: last.value.controls,
    finalHeight: last.value.height,
    firstControls,
    firstHeight,
  };
}
