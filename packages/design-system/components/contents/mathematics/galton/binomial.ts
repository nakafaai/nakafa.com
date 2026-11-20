import { Array as Arr } from "effect";

/**
 * The binomial distribution a Galton board draws. A ball meets one pin in
 * each of `rows` rows and goes right at each with probability `p`, so the
 * bin it lands in counts its rights, k, and P(k) = C(n, k) p^k (1 - p)^(n - k).
 */

/** The number of ways to choose `k` of `n`, C(n, k), built as a running product so it stays exact for a board's few rows. */
export function choose(n: number, k: number) {
  if (k < 0 || k > n) {
    return 0;
  }
  const smaller = Math.min(k, n - k);
  if (smaller === 0) {
    return 1;
  }
  return Arr.reduce(
    Arr.range(1, smaller),
    1,
    (product, step) => (product * (n - smaller + step)) / step
  );
}

/** The probability that a ball lands in bin `k` of a board with `rows` rows of pins. */
export function binomialProbability(rows: number, p: number, k: number) {
  return choose(rows, k) * p ** k * (1 - p) ** (rows - k);
}

/** The expected number of balls in each bin, 0 to `rows`, after `balls` balls. */
export function expectedCounts(rows: number, p: number, balls: number) {
  return Arr.map(
    Arr.range(0, rows),
    (k) => balls * binomialProbability(rows, p, k)
  );
}

/** The mean of the bin a ball lands in, np. */
export function binomialMean(rows: number, p: number) {
  return rows * p;
}

/** The standard deviation of the bin a ball lands in, the square root of np(1 - p). */
export function binomialSpread(rows: number, p: number) {
  return Math.sqrt(rows * p * (1 - p));
}

/**
 * The most likely bin, the floor of (n + 1)p. When (n + 1)p is a whole
 * number, that bin and the one below it are equally likely, and this is the
 * upper of the two.
 */
export function binomialMode(rows: number, p: number) {
  return Math.min(rows, Math.floor((rows + 1) * p + 1e-9));
}
