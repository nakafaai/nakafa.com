import { Array as Arr, Option } from "effect";

/** The angle the unit circle opens on, which its lab and its static card both draw. */
export const UNIT_CIRCLE_DEFAULT_ANGLE = 45;

/** How the unit circle writes its numbers: two places and no grouping. */
export const TRIG_NUMBER_OPTIONS = {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  useGrouping: false,
} satisfies Intl.NumberFormatOptions;

/** The common values of the unit circle, written as the fraction or root a reader expects. */
const COMMON_RATIOS = [
  { value: 0.5, display: "\\frac{1}{2}" },
  { value: Math.SQRT1_2, display: "\\frac{\\sqrt{2}}{2}" },
  { value: Math.sqrt(3) / 2, display: "\\frac{\\sqrt{3}}{2}" },
  { value: 1, display: "1" },
  { value: Math.sqrt(3), display: "\\sqrt{3}" },
  { value: Math.sqrt(3) / 3, display: "\\frac{\\sqrt{3}}{3}" },
];

/**
 * The math that follows the symbol of one trigonometric ratio: an exact value
 * when the angle has one, or an approximation to two places otherwise. The
 * caller formats the approximation, because its digits follow the locale. A
 * comma decimal is written as "{,}", so the math keeps a decimal's spacing.
 */
export function formatTrigRatioMath(
  value: number,
  formatApproximation: (value: number) => string,
  exactValue?: string
) {
  if (exactValue !== undefined) {
    return `= ${exactValue}`;
  }
  if (Math.abs(value) < 1e-10) {
    return "= 0";
  }
  const exact = Arr.findFirst(
    COMMON_RATIOS,
    (candidate) => Math.abs(Math.abs(value) - candidate.value) < 1e-10
  );
  if (Option.isSome(exact)) {
    return `= ${value < 0 ? "-" : ""}${exact.value.display}`;
  }
  return `\\approx ${formatApproximation(value).replaceAll(",", "{,}")}`;
}
