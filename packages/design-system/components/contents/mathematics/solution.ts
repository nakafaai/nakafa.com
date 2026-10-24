import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import type { NumberLineSegment } from "@repo/design-system/components/contents/mathematics/number-line";
import { segmentBounds } from "@repo/design-system/components/contents/mathematics/segment";
import { Array as Arr } from "effect";

/**
 * The part of a number-line segment that its solution set reads. Its bounds may
 * be missing, which means infinite, so it keeps the type of the number line's own
 * segment.
 */
type SolutionSegment = Pick<
  NumberLineSegment,
  "end" | "endInclusive" | "shaded" | "start" | "startInclusive"
>;

/** A bound as math: an infinite bound is its symbol, and a finite bound is its number. */
function boundMath(value: number, formatNumber: (value: number) => string) {
  if (value === Number.NEGATIVE_INFINITY) {
    return "-\\infty";
  }
  if (value === Number.POSITIVE_INFINITY) {
    return "\\infty";
  }
  return mathNumber(formatNumber(value));
}

/** One segment in interval notation. An infinite bound is always open. */
function segmentMath(
  segment: SolutionSegment,
  formatNumber: (value: number) => string,
  separator: string
) {
  const bounds = segmentBounds(segment);
  const open =
    segment.startInclusive === true && Number.isFinite(bounds.start)
      ? "["
      : "(";
  const close =
    segment.endInclusive === true && Number.isFinite(bounds.end) ? "]" : ")";
  const start = boundMath(bounds.start, formatNumber);
  const end = boundMath(bounds.end, formatNumber);
  return `${open}${start}${separator}${end}${close}`;
}

/**
 * The solution set of a number line as math: its shaded segments in interval
 * notation, joined by a union sign. A segment is shaded unless it says otherwise,
 * and with no shaded segment the solution set is empty.
 */
export function solutionSetMath(
  segments: readonly SolutionSegment[],
  formatNumber: (value: number) => string,
  separator: string
) {
  const shaded = Arr.filter(segments, (segment) => segment.shaded ?? true);
  if (!Arr.isReadonlyArrayNonEmpty(shaded)) {
    return "\\varnothing";
  }
  return Arr.join(
    Arr.map(shaded, (segment) => segmentMath(segment, formatNumber, separator)),
    " \\cup "
  );
}
