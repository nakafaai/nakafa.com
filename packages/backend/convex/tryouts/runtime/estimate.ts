import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { ConvexError } from "convex/values";

const MAX_THETA = 4;
const MIN_THETA = -4;
const THETA_ITERATIONS = 25;
const THETA_STEP_LIMIT = 1;
const THETA_TOLERANCE = 0.001;
const MIN_INFORMATION = 0.000_001;
const IRT_SCORE_MEAN = 500;
const IRT_SCORE_STANDARD_DEVIATION = 100;

/** One calibrated item paired with the observed attempt answer. */
export interface IrtItemAnswer {
  isCorrect: boolean;
  item: Doc<"irtScaleItems">;
}

/** Estimates theta, standard error, and the public score for one IRT vector. */
export function estimateIrtScore(itemAnswers: IrtItemAnswer[]) {
  let theta = 0;

  for (let index = 0; index < THETA_ITERATIONS; index++) {
    const step = getThetaStep(itemAnswers, theta);

    if (Math.abs(step) < THETA_TOLERANCE) {
      break;
    }

    theta = clamp(theta + step, MIN_THETA, MAX_THETA);
  }

  const information = getInformation(itemAnswers, theta);

  if (information < MIN_INFORMATION) {
    throw new ConvexError({
      code: "TRYOUT_IRT_INFORMATION_TOO_LOW",
      message: "IRT scale information is too low for scoring this attempt.",
    });
  }

  return {
    publishedScore: getPublishedIrtScore(theta),
    theta,
    thetaSE: 1 / Math.sqrt(information),
  };
}

/** Computes one bounded Newton step for the current theta. */
function getThetaStep(itemAnswers: IrtItemAnswer[], theta: number) {
  let score = 0;
  let information = 0;

  for (const itemAnswer of itemAnswers) {
    const discrimination = getDiscrimination(itemAnswer.item);
    const expected = getExpectedProbability(itemAnswer.item, theta);
    const observed = itemAnswer.isCorrect ? 1 : 0;

    score += discrimination * (observed - expected);
    information += discrimination * discrimination * expected * (1 - expected);
  }

  if (information < MIN_INFORMATION) {
    return 0;
  }

  return clamp(score / information, -THETA_STEP_LIMIT, THETA_STEP_LIMIT);
}

/** Computes Fisher information for a complete item response vector. */
function getInformation(itemAnswers: IrtItemAnswer[], theta: number) {
  return itemAnswers.reduce((total, itemAnswer) => {
    const discrimination = getDiscrimination(itemAnswer.item);
    const expected = getExpectedProbability(itemAnswer.item, theta);

    return total + discrimination * discrimination * expected * (1 - expected);
  }, 0);
}

/** Returns the 2PL expected correctness probability for one item. */
function getExpectedProbability(item: Doc<"irtScaleItems">, theta: number) {
  const discrimination = getDiscrimination(item);
  const exponent = -discrimination * (theta - item.difficulty);

  return 1 / (1 + Math.exp(exponent));
}

/** Rejects invalid IRT item parameters before scoring. */
function getDiscrimination(item: Doc<"irtScaleItems">) {
  if (item.discrimination > 0) {
    return item.discrimination;
  }

  throw new ConvexError({
    code: "TRYOUT_IRT_ITEM_INVALID",
    message: "IRT item discrimination must be positive.",
  });
}

/** Converts theta into the public IRT score scale. */
function getPublishedIrtScore(theta: number) {
  const score = IRT_SCORE_MEAN + theta * IRT_SCORE_STANDARD_DEVIATION;

  return clamp(Math.round(score), 0, 1000);
}

/** Clamps numeric estimates and public scores into their allowed range. */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
