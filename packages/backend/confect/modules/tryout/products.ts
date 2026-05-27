import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { Effect, Schema } from "effect";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1e3;
const SNBT_ATTEMPT_WINDOW_DAYS = 3;
const SNBT_SIMULATION_SECONDS_PER_QUESTION = 90;
const SNBT_REPORT_SCORE_MIN = 0;
const SNBT_REPORT_SCORE_MAX = 1e3;
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

export const tryoutProducts = ["snbt"] as const;
export const primaryTryoutProduct = tryoutProducts[0];

/** Tryout products currently supported by persisted tryout tables. */
export const tryoutProductSchema = Schema.Literal(...tryoutProducts);

export class TryoutPolicyError extends Schema.TaggedError<TryoutPolicyError>()(
  "TryoutPolicyError",
  { message: Schema.String }
) {}

export type TryoutProduct = Schema.Schema.Type<typeof tryoutProductSchema>;

interface DetectableTryoutSet {
  readonly _id: Id<"exerciseSets">;
  readonly exerciseType: string;
  readonly material: string;
  readonly questionCount: number;
  readonly setName: string;
  readonly slug: string;
  readonly title: string;
  readonly type: string;
}

interface DetectedTryoutPart {
  readonly partKey: string;
  readonly setId: Id<"exerciseSets">;
}

interface DetectedTryout {
  readonly cycleKey: string;
  readonly isActive: boolean;
  readonly label: string;
  readonly locale: Locale;
  readonly partCount: number;
  readonly parts: readonly DetectedTryoutPart[];
  readonly product: TryoutProduct;
  readonly slug: string;
  readonly totalQuestionCount: number;
}

interface TryoutPolicy {
  readonly attemptWindowMs: number;
  readonly compareTryouts: (
    left: DetectedTryout,
    right: DetectedTryout
  ) => number;
  readonly detectTryouts: (input: {
    readonly locale: Locale;
    readonly requiredPartKeys: readonly string[];
    readonly sets: readonly DetectableTryoutSet[];
  }) => readonly DetectedTryout[];
  readonly getLeaderboardNamespace: (input: {
    readonly cycleKey: string;
    readonly locale: string;
    readonly product: TryoutProduct;
  }) => string;
  readonly getPartTimeLimitSeconds: (questionCount: number) => number;
  readonly scaleThetaToScore: (theta: number) => number;
}

interface SnbtCandidateSet extends DetectableTryoutSet {
  readonly cycleKey: string;
}

interface SnbtCandidateGroup {
  readonly firstSet: SnbtCandidateSet;
  readonly sets: SnbtCandidateSet[];
}

/** Checks whether a route/product string is one of the supported tryout products. */
export const isTryoutProduct = Schema.is(tryoutProductSchema);

/** Fails a pure policy calculation with a typed Effect error. */
function failTryoutPolicy(message: string) {
  return Effect.runSync(Effect.fail(new TryoutPolicyError({ message })));
}

/** Extracts the SNBT cycle key from a synced tryout set slug. */
function getSnbtCycleKeyFromSetSlug(setSlug: string) {
  const match = setSlug.match(YEARFUL_TRYOUT_SET_SLUG_REGEX);
  return match?.[1] ?? null;
}

/** Sorts detected SNBT tryouts from newest cycle to oldest, then by label. */
function compareSnbtTryouts(left: DetectedTryout, right: DetectedTryout) {
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

/** Converts an operational IRT theta into the public SNBT score scale. */
function scaleSnbtThetaToScore(theta: number) {
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

/** Product-specific rules for SNBT tryouts. */
const snbtTryoutProductPolicy = {
  attemptWindowMs: SNBT_ATTEMPT_WINDOW_MS,
  compareTryouts: compareSnbtTryouts,
  detectTryouts: ({ locale, requiredPartKeys, sets }) => {
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
    const setsByKey = new Map<string, SnbtCandidateGroup>();

    for (const set of candidateSets) {
      const key = `${set.cycleKey}:${set.setName}`;
      const group = setsByKey.get(key);

      if (!group) {
        setsByKey.set(key, { firstSet: set, sets: [set] });
        continue;
      }

      group.sets.push(set);
    }

    const detectedTryouts: DetectedTryout[] = [];
    for (const { firstSet, sets: groupedSets } of setsByKey.values()) {
      const materials = new Set(groupedSets.map((set) => set.material));
      const hasAllRequiredParts = requiredPartKeys.every((material) =>
        materials.has(material)
      );
      const hasExpectedPartCount =
        groupedSets.length === requiredPartKeys.length;
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
          requiredPartKeys.indexOf(left.material) -
          requiredPartKeys.indexOf(right.material)
      );
      const totalQuestionCount = sortedSets.reduce(
        (count, set) => count + set.questionCount,
        0
      );

      detectedTryouts.push({
        product: primaryTryoutProduct,
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
  getPartTimeLimitSeconds: (questionCount) => {
    if (questionCount <= 0) {
      return failTryoutPolicy("questionCount must be greater than 0.");
    }

    return questionCount * SNBT_SIMULATION_SECONDS_PER_QUESTION;
  },
  scaleThetaToScore: scaleSnbtThetaToScore,
} satisfies TryoutPolicy;

/** Product-specific tryout policy implementations. */
export const tryoutProductPolicies = {
  snbt: snbtTryoutProductPolicy,
} as const;
