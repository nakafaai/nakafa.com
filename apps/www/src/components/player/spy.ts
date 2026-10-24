import { Array as Arr, Number as Num, Option, String as Str } from "effect";

/**
 * How far below the top of a revealed question the reading line sits, so the
 * line falls inside the question and not on its edge.
 */
const READING_DEPTH = 8;

/** The pixels of a computed CSS length such as `80px`, or none when it is not a finite length in pixels. */
export function readPixels(length: string) {
  return Option.filter(
    Option.flatMap(Option.liftPredicate(length, Str.endsWith("px")), (pixels) =>
      Num.parse(Str.slice(0, -2)(pixels))
    ),
    Number.isFinite
  );
}

/**
 * Root margin that shrinks the viewport to a band one pixel high at the reading
 * line, so an observer reports the question under that line and nothing else.
 * `clearance` is the scroll margin above a question, which is where a revealed
 * question rests, so the line follows the CSS that reveals it.
 */
export function readingBand(viewportHeight: number, clearance: number) {
  const line = clearance + READING_DEPTH;
  const bottom = Math.max(0, viewportHeight - line - 1);
  return `-${line}px 0px -${bottom}px 0px`;
}

/**
 * Root margin that keeps the end of the list out of view until it clears the
 * footer, which covers the bottom of the window by `footerHeight`.
 */
export function endBand(footerHeight: number) {
  return `0px 0px -${footerHeight}px 0px`;
}

/**
 * The question under the reading line after one batch of observer entries: the
 * last question that entered the line wins, and the previous one stays while
 * the line sits in a gap between questions.
 */
export function nextBand(previous: string | null, entered: readonly string[]) {
  return Option.getOrElse(Arr.last(entered), () => previous);
}

/**
 * The question to mark current: the last one once the reader has scrolled to the
 * end of the list, else the one under the line. A list that fits in the window
 * has no end to scroll to, so it keeps the question under the line.
 */
export function spyCandidate(
  spy: { band: string | null; end: boolean; scrolled: boolean },
  lastKey: string | null
) {
  return spy.end && spy.scrolled ? lastKey : spy.band;
}
