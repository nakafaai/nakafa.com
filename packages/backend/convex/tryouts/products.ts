import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutProducts = ["snbt"] as const;

export const tryoutProductValidator = literals(...tryoutProducts);

export type TryoutProduct = Infer<typeof tryoutProductValidator>;

interface TryoutSetCandidate<SetId, Locale extends string = string> {
  _id: SetId;
  exerciseType: string;
  locale: Locale;
  material: string;
  questionCount: number;
  setName: string;
  slug: string;
  type: string;
}

interface DetectedTryout<SetId, Locale extends string = string> {
  /** Product-defined cycle identifier, not a closed enum. */
  cycleKey: string;
  isActive: boolean;
  label: string;
  locale: Locale;
  partCount: number;
  product: TryoutProduct;
  setIds: SetId[];
  slug: string;
  totalQuestionCount: number;
}

interface TryoutRecordLike {
  /** Product-defined cycle identifier used for sorting and leaderboard scope. */
  cycleKey: string;
  label: string;
  locale: string;
  product: TryoutProduct;
}

interface TryoutProductPolicy {
  compareTryouts: (left: TryoutRecordLike, right: TryoutRecordLike) => number;
  detectTryouts: <SetId, Locale extends string>(args: {
    locale: Locale;
    sets: TryoutSetCandidate<SetId, Locale>[];
  }) => DetectedTryout<SetId, Locale>[];
  getAttemptWindowMs: () => number;
  getLeaderboardNamespace: (args: {
    cycleKey: string;
    locale: string;
    product: TryoutProduct;
  }) => string;
  getPartTimeLimitSeconds: (questionCount: number) => number;
  scaleThetaToScore: (theta: number) => number;
}

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const SNBT_SIMULATION_SECONDS_PER_QUESTION = 90;
const SNBT_SCORE_MIN = 200;
const SNBT_SCORE_MAX = 1000;
const SNBT_SCORE_CENTER = 600;
const SNBT_SCORE_SCALE = 100;

const SNBT_ATTEMPT_WINDOW_MS =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;

const snbtRequiredPartKeys = [
  "quantitative-knowledge",
  "mathematical-reasoning",
  "general-reasoning",
  "indonesian-language",
  "english-language",
  "general-knowledge",
  "reading-and-writing-skills",
] as const;

const snbtPartOrder = new Map<string, number>(
  snbtRequiredPartKeys.map((material, index) => [material, index])
);

const YEARFUL_TRYOUT_SET_SLUG_REGEX =
  /^exercises\/[^/]+\/[^/]+\/[^/]+\/try-out\/(\d{4})\/[^/]+$/;

function getSnbtCycleKeyFromSetSlug(setSlug: string) {
  const match = setSlug.match(YEARFUL_TRYOUT_SET_SLUG_REGEX);

  if (!match) {
    return null;
  }

  return match[1];
}

function sortSnbtSets<SetId>(sets: TryoutSetCandidate<SetId>[]) {
  return [...sets].sort(
    (left, right) =>
      (snbtPartOrder.get(left.material) ?? Number.MAX_SAFE_INTEGER) -
      (snbtPartOrder.get(right.material) ?? Number.MAX_SAFE_INTEGER)
  );
}

function compareSnbtTryouts(left: TryoutRecordLike, right: TryoutRecordLike) {
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

const tryoutProductPolicies = {
  snbt: {
    compareTryouts: compareSnbtTryouts,
    detectTryouts: <SetId, Locale extends string>({
      locale,
      sets,
    }: {
      locale: Locale;
      sets: TryoutSetCandidate<SetId, Locale>[];
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
        const key = `${set.cycleKey}:${set.setName}`;
        const existing = setsByKey.get(key) ?? [];
        existing.push(set);
        setsByKey.set(key, existing);
      }

      const detectedTryouts: DetectedTryout<SetId, Locale>[] = [];

      for (const groupedSets of setsByKey.values()) {
        const firstSet = groupedSets[0];

        if (!firstSet) {
          continue;
        }

        const materials = new Set(groupedSets.map((set) => set.material));
        const hasAllRequiredParts = snbtRequiredPartKeys.every((material) =>
          materials.has(material)
        );
        const hasPositiveQuestionCounts = groupedSets.every(
          (set) => set.questionCount > 0
        );

        if (!(hasAllRequiredParts && hasPositiveQuestionCounts)) {
          continue;
        }

        const sortedSets = sortSnbtSets(groupedSets);
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
          partCount: snbtRequiredPartKeys.length,
          totalQuestionCount,
          isActive: true,
          setIds: sortedSets.map((set) => set._id),
        });
      }

      return detectedTryouts;
    },
    getAttemptWindowMs: () => SNBT_ATTEMPT_WINDOW_MS,
    getLeaderboardNamespace: ({ product, locale, cycleKey }) =>
      `${product}:${locale}:${cycleKey}`,
    getPartTimeLimitSeconds: (questionCount) => {
      if (questionCount <= 0) {
        throw new Error("questionCount must be greater than 0.");
      }

      return questionCount * SNBT_SIMULATION_SECONDS_PER_QUESTION;
    },
    scaleThetaToScore: (theta) => {
      const score = SNBT_SCORE_CENTER + theta * SNBT_SCORE_SCALE;
      return Math.round(
        Math.max(SNBT_SCORE_MIN, Math.min(SNBT_SCORE_MAX, score))
      );
    },
  },
} satisfies Record<TryoutProduct, TryoutProductPolicy>;

export function getTryoutProductPolicy(product: TryoutProduct) {
  return tryoutProductPolicies[product];
}

export function getTryoutLeaderboardNamespace(args: {
  cycleKey: string;
  locale: string;
  product: TryoutProduct;
}) {
  return getTryoutProductPolicy(args.product).getLeaderboardNamespace(args);
}

export function sortTryoutsForProduct<T extends TryoutRecordLike>(
  product: TryoutProduct,
  tryouts: T[]
) {
  return [...tryouts].sort(getTryoutProductPolicy(product).compareTryouts);
}

export function detectTryoutsForProduct<SetId, Locale extends string>(args: {
  locale: Locale;
  product: TryoutProduct;
  sets: TryoutSetCandidate<SetId, Locale>[];
}) {
  return getTryoutProductPolicy(args.product).detectTryouts(args);
}

export function computeTryoutPartTimeLimitSeconds(args: {
  product: TryoutProduct;
  questionCount: number;
}) {
  return getTryoutProductPolicy(args.product).getPartTimeLimitSeconds(
    args.questionCount
  );
}

export function computeTryoutExpiresAtMs(args: {
  product: TryoutProduct;
  startedAtMs: number;
}) {
  return (
    args.startedAtMs + getTryoutProductPolicy(args.product).getAttemptWindowMs()
  );
}

export function scaleThetaToTryoutScore(args: {
  product: TryoutProduct;
  theta: number;
}) {
  return getTryoutProductPolicy(args.product).scaleThetaToScore(args.theta);
}
