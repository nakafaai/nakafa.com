import { Array as Arr, Result } from "effect";

/**
 * The fewest numbered grid lines across the shorter side of a view. A major
 * step is rounded up to 1, 2 or 5 times a power of ten, so between four and
 * ten numbered lines cross that side, at any zoom.
 */
const MAJOR_LINES = 4;

/**
 * The grid steps of one axis over a visible span in mathematical units: the
 * numbered major step, the minor step between major lines (a fifth of it, or a
 * quarter of a step of 2, so minor lines land on 0.5 and not 0.4), and the
 * decimals a major value needs. The scene's grid, its ticks and the still all
 * read these, so they agree at every zoom.
 */
export function gridSteps(span: number) {
  if (!(Number.isFinite(span) && span > 0)) {
    return { digits: 0, major: 1, minor: 0.2 };
  }
  const exponent = Math.floor(Math.log10(span / MAJOR_LINES));
  const power = 10 ** exponent;
  const mantissa = span / MAJOR_LINES / power;
  let nice = 10;
  if (mantissa <= 1) {
    nice = 1;
  } else if (mantissa <= 2) {
    nice = 2;
  } else if (mantissa <= 5) {
    nice = 5;
  }
  const major = nice * power;
  return {
    digits: Math.max(0, -Math.floor(Math.log10(major) + 1e-9)),
    major,
    minor: major / (nice === 2 ? 4 : 5),
  };
}

/**
 * Every multiple of a step inside a range, nearest zero first dropped when it
 * is zero itself: the origin is where both axes cross and names itself.
 */
export function stepValues(
  range: { readonly max: number; readonly min: number },
  step: number,
  limit: number
) {
  const first = Math.ceil(range.min / step);
  const last = Math.floor(range.max / step);
  // One more than the limit, in case zero is among them and drops out.
  const count =
    Number.isFinite(first) && Number.isFinite(last)
      ? Math.max(0, Math.min(last - first + 1, limit + 1))
      : 0;
  // `makeBy` always makes at least one element.
  if (count === 0) {
    return [];
  }
  return Arr.take(
    Arr.filterMap(
      Arr.makeBy(count, (offset) => first + offset),
      (index) => (index === 0 ? Result.failVoid : Result.succeed(index * step))
    ),
    limit
  );
}
