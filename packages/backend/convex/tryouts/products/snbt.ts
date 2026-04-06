import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getSubjects } from "@repo/contents/exercises/high-school/_data/subject";
import { ConvexError } from "convex/values";
import type { DetectedTryout, TryoutProductPolicy } from ".";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const SNBT_ATTEMPT_WINDOW_DAYS = 3;
const SNBT_SIMULATION_SECONDS_PER_QUESTION = 90;
const SNBT_REPORT_SCORE_MIN = 0;
const SNBT_REPORT_SCORE_MAX = 1000;
const SNBT_REPORT_THETA_MIN = -4;
const SNBT_REPORT_THETA_MAX = 4;
const YEARFUL_TRYOUT_SET_SLUG_REGEX =
  /^exercises\/[^/]+\/[^/]+\/[^/]+\/try-out\/(\d{4})\/[^/]+$/;

const SNBT_ATTEMPT_WINDOW_MS =
  SNBT_ATTEMPT_WINDOW_DAYS *
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;

const snbtPartLabels = getSubjects("snbt").map((subject) => subject.label);
const snbtPartOrder = new Map(
  snbtPartLabels.map((material, index) => [material, index])
);
/** Extracts the SNBT cycle year from a yearful tryout set slug. */
function getSnbtCycleKeyFromSetSlug(setSlug: Doc<"exerciseSets">["slug"]) {
  const match = setSlug.match(YEARFUL_TRYOUT_SET_SLUG_REGEX);

  if (!match) {
    return null;
  }

  return match[1];
}

/** Sorts SNBT tryouts by newest cycle and then by label. */
function compareSnbtTryouts(
  left: Pick<Doc<"tryouts">, "cycleKey" | "label" | "slug">,
  right: Pick<Doc<"tryouts">, "cycleKey" | "label" | "slug">
) {
  const cycleComparison = right.cycleKey.localeCompare(left.cycleKey);

  if (cycleComparison !== 0) {
    return cycleComparison;
  }

  const labelComparison = left.label.localeCompare(right.label);

  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.slug.localeCompare(right.slug);
}

/**
 * Map the bounded operational theta estimate onto SNBT's public 0-1000
 * report-score scale.
 *
 * The public score intentionally stays anchored to `[-4, 4]` even though the
 * estimator now integrates over a slightly wider interval. That keeps the user-
 * facing score range stable while letting latent-theta estimation breathe more
 * at the tails.
 */
function scaleSnbtThetaToScore(theta: Doc<"tryoutAttempts">["theta"]) {
  const boundedTheta = Math.max(
    SNBT_REPORT_THETA_MIN,
    Math.min(SNBT_REPORT_THETA_MAX, theta)
  );
  const normalizedTheta =
    (boundedTheta - SNBT_REPORT_THETA_MIN) /
    (SNBT_REPORT_THETA_MAX - SNBT_REPORT_THETA_MIN);
  const scaledScore =
    SNBT_REPORT_SCORE_MIN +
    normalizedTheta * (SNBT_REPORT_SCORE_MAX - SNBT_REPORT_SCORE_MIN);

  return Math.round(scaledScore);
}

/** SNBT policy is derived from the high-school subject source of truth. */
export const snbtTryoutProductPolicy = {
  attemptWindowMs: SNBT_ATTEMPT_WINDOW_MS,
  compareTryouts: compareSnbtTryouts,
  detectTryouts: ({ locale, sets }) => {
    const candidateSets = sets.flatMap((set) => {
      if (set.type !== "snbt" || set.exerciseType !== "try-out") {
        return [];
      }

      const cycleKey = getSnbtCycleKeyFromSetSlug(set.slug);

      if (cycleKey === null) {
        return [];
      }

      return [{ ...set, cycleKey }];
    });
    const setsByKey = new Map<string, typeof candidateSets>();

    for (const set of candidateSets) {
      const groupedSets = setsByKey.get(`${set.cycleKey}:${set.setName}`) ?? [];
      groupedSets.push(set);
      setsByKey.set(`${set.cycleKey}:${set.setName}`, groupedSets);
    }

    const detectedTryouts: DetectedTryout[] = [];

    for (const groupedSets of setsByKey.values()) {
      const firstSet = groupedSets[0];

      if (!firstSet) {
        continue;
      }

      const materials = new Set(groupedSets.map((set) => set.material));
      const hasAllRequiredParts = snbtPartLabels.every((material) =>
        materials.has(material)
      );
      const hasExpectedPartCount = groupedSets.length === snbtPartLabels.length;
      const hasPositiveQuestionCounts = groupedSets.every(
        (set) => set.questionCount > 0
      );

      if (
        !(
          hasAllRequiredParts &&
          hasExpectedPartCount &&
          hasPositiveQuestionCounts
        )
      ) {
        continue;
      }

      const sortedSets = [...groupedSets].sort(
        (left, right) =>
          (snbtPartOrder.get(left.material) ?? Number.MAX_SAFE_INTEGER) -
          (snbtPartOrder.get(right.material) ?? Number.MAX_SAFE_INTEGER)
      );
      const totalQuestionCount = sortedSets.reduce(
        (count, set) => count + set.questionCount,
        0
      );

      detectedTryouts.push({
        product: "snbt",
        locale,
        cycleKey: firstSet.cycleKey,
        label: firstSet.title,
        slug: `${firstSet.cycleKey}-${firstSet.setName}`,
        partCount: sortedSets.length,
        totalQuestionCount,
        isActive: true,
        parts: sortedSets.map((set) => ({
          partKey: set.material,
          setId: set._id,
        })),
      });
    }

    return detectedTryouts;
  },
  getLeaderboardNamespace: ({ product, locale, cycleKey }) =>
    `${product}:${locale}:${cycleKey}`,
  getPartTimeLimitSeconds: (
    questionCount: Doc<"exerciseSets">["questionCount"]
  ) => {
    if (questionCount <= 0) {
      throw new ConvexError({
        code: "TRYOUT_QUESTION_COUNT_INVALID",
        message: "questionCount must be greater than 0.",
      });
    }

    return questionCount * SNBT_SIMULATION_SECONDS_PER_QUESTION;
  },
  scaleThetaToScore: scaleSnbtThetaToScore,
} satisfies TryoutProductPolicy;
