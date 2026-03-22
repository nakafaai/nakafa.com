import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getSubjects } from "@repo/contents/exercises/high-school/_data/subject";
import type { DetectedTryout, TryoutProductPolicy } from ".";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const SNBT_ATTEMPT_WINDOW_DAYS = 3;
const SNBT_SIMULATION_SECONDS_PER_QUESTION = 90;
const SNBT_SCORE_MIN = 200;
const SNBT_SCORE_MAX = 1000;
const SNBT_SCORE_CENTER = 600;
const SNBT_SCORE_SCALE = 100;
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
  left: Pick<Doc<"tryouts">, "cycleKey" | "label">,
  right: Pick<Doc<"tryouts">, "cycleKey" | "label">
) {
  return (
    right.cycleKey.localeCompare(left.cycleKey) ||
    left.label.localeCompare(right.label)
  );
}

/** SNBT policy is derived from the high-school subject source of truth. */
export const snbtTryoutProductPolicy = {
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
  getAttemptWindowMs: () => SNBT_ATTEMPT_WINDOW_MS,
  getLeaderboardNamespace: ({ product, locale, cycleKey }) =>
    `${product}:${locale}:${cycleKey}`,
  getPartTimeLimitSeconds: (
    questionCount: Doc<"exerciseSets">["questionCount"]
  ) => {
    if (questionCount <= 0) {
      throw new Error("questionCount must be greater than 0.");
    }

    return questionCount * SNBT_SIMULATION_SECONDS_PER_QUESTION;
  },
  scaleThetaToScore: (theta: Doc<"tryoutAttempts">["theta"]) => {
    const score = SNBT_SCORE_CENTER + theta * SNBT_SCORE_SCALE;
    return Math.round(
      Math.max(SNBT_SCORE_MIN, Math.min(SNBT_SCORE_MAX, score))
    );
  },
} satisfies TryoutProductPolicy;
