import { Number as Num } from "effect";

/** After this many answers a rating stops being a plain mean, so a student's recent work counts. */
const RATING_WINDOW = 10;

/**
 * A student's rating after one more answer: `share` is the part of the question's points they earned, from 0 to 1. The
 * first ten answers make a plain mean, and each later one moves the rating a tenth of the way to it, so one answer
 * writes one number and no history is read again (ADR 0035).
 */
export const ratingAfter = (
  rating: number,
  observations: number,
  share: number
) => rating + (share - rating) / Num.min(observations + 1, RATING_WINDOW);

/** The standard normal distribution at `z`, by the Abramowitz and Stegun approximation 26.2.17. */
const normal = (z: number) => {
  const x = Math.abs(z);
  const t = 1 / (1 + 0.231_641_9 * x);
  const density = Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const tail =
    density *
    t *
    (0.319_381_53 +
      t *
        (-0.356_563_782 +
          t * (1.781_477_937 + t * (-1.821_255_978 + t * 1.330_274_429))));
  return z >= 0 ? 1 - tail : tail;
};

/**
 * The chance that a student reaches the KKTP in a competency, from 0 to 1: a uniform prior updated by the points they
 * earned and lost, and the share of that Beta distribution above the KKTP, through its normal approximation. It reads
 * only stored points, so its reason is those points, and it never changes a grade (ADR 0035).
 */
export const chanceOf = (earned: number, possible: number, kktp: number) => {
  const reached = earned + 1;
  const missed = possible - earned + 1;
  const total = reached + missed;
  const mean = reached / total;
  const spread = Math.sqrt((reached * missed) / (total * total * (total + 1)));
  return 1 - normal((kktp / 100 - mean) / spread);
};
