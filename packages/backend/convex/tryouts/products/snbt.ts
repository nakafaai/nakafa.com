import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getSubjects } from "@repo/contents/exercises/high-school/_data/subject";
import type { DetectedTryout, TryoutSetCandidate } from ".";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const SNBT_SIMULATION_SECONDS_PER_QUESTION = 90;
const SNBT_SCORE_MIN = 200;
const SNBT_SCORE_MAX = 1000;
const SNBT_SCORE_CENTER = 600;
const SNBT_SCORE_SCALE = 100;
const YEARFUL_TRYOUT_SET_SLUG_REGEX =
  /^exercises\/[^/]+\/[^/]+\/[^/]+\/try-out\/(\d{4})\/[^/]+$/;

const SNBT_ATTEMPT_WINDOW_MS =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;

const snbtPartLabels = getSubjects("snbt").map((subject) => subject.label);
const snbtPartOrder = new Map(
  snbtPartLabels.map((material, index) => [material, index])
);

function getSnbtCycleKeyFromSetSlug(setSlug: Doc<"exerciseSets">["slug"]) {
  const match = setSlug.match(YEARFUL_TRYOUT_SET_SLUG_REGEX);

  if (!match) {
    return null;
  }

  return match[1];
}

function compareSnbtTryouts(
  left: Pick<Doc<"tryouts">, "cycleKey" | "label">,
  right: Pick<Doc<"tryouts">, "cycleKey" | "label">
) {
  const leftYear = Number.parseInt(left.cycleKey, 10);
  const rightYear = Number.parseInt(right.cycleKey, 10);

  if (!(Number.isNaN(leftYear) || Number.isNaN(rightYear))) {
    return rightYear - leftYear || left.label.localeCompare(right.label);
  }

  return (
    right.cycleKey.localeCompare(left.cycleKey) ||
    left.label.localeCompare(right.label)
  );
}

/** SNBT policy is derived from the high-school subject source of truth. */
export const snbtTryoutProductPolicy = {
  compareTryouts: compareSnbtTryouts,
  detectTryouts: ({
    locale,
    sets,
  }: {
    locale: TryoutSetCandidate["locale"];
    sets: TryoutSetCandidate[];
  }) => {
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
      const hasPositiveQuestionCounts = groupedSets.every(
        (set) => set.questionCount > 0
      );

      if (!(hasAllRequiredParts && hasPositiveQuestionCounts)) {
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
        label: firstSet.setName,
        slug: `${firstSet.cycleKey}-${firstSet.setName}`,
        partCount: snbtPartLabels.length,
        totalQuestionCount,
        isActive: true,
        setIds: sortedSets.map((set) => set._id),
      });
    }

    return detectedTryouts;
  },
  getAttemptWindowMs: () => SNBT_ATTEMPT_WINDOW_MS,
  getLeaderboardNamespace: ({
    product,
    locale,
    cycleKey,
  }: Pick<Doc<"tryouts">, "product" | "locale" | "cycleKey">) =>
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
};
