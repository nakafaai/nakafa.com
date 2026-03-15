import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutProducts = ["snbt"] as const;

export const tryoutProductValidator = literals(...tryoutProducts);

export type TryoutProduct = Infer<typeof tryoutProductValidator>;

type TryoutSetCandidate = Pick<
  Doc<"exerciseSets">,
  | "_id"
  | "exerciseType"
  | "locale"
  | "material"
  | "questionCount"
  | "setName"
  | "slug"
  | "type"
>;

type DetectedTryout = Pick<
  Doc<"tryouts">,
  | "cycleKey"
  | "isActive"
  | "label"
  | "locale"
  | "partCount"
  | "product"
  | "slug"
  | "totalQuestionCount"
> & {
  setIds: Id<"exerciseSets">[];
};

type TryoutRecord = Pick<
  Doc<"tryouts">,
  "cycleKey" | "label" | "locale" | "product"
>;
type TryoutLeaderboardNamespaceArgs = Pick<
  Doc<"tryouts">,
  "cycleKey" | "locale" | "product"
>;
type SnbtTryoutSetCandidate = TryoutSetCandidate & {
  cycleKey: Doc<"tryouts">["cycleKey"];
};

interface TryoutProductPolicy {
  compareTryouts: (left: TryoutRecord, right: TryoutRecord) => number;
  detectTryouts: (args: {
    locale: TryoutSetCandidate["locale"];
    sets: TryoutSetCandidate[];
  }) => DetectedTryout[];
  getAttemptWindowMs: () => number;
  getLeaderboardNamespace: (args: TryoutLeaderboardNamespaceArgs) => string;
  getPartTimeLimitSeconds: (
    questionCount: Doc<"exerciseSets">["questionCount"]
  ) => number;
  scaleThetaToScore: (theta: Doc<"tryoutAttempts">["theta"]) => number;
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

const snbtPartOrder = new Map<TryoutSetCandidate["material"], number>(
  snbtRequiredPartKeys.map((material, index) => [material, index])
);

const YEARFUL_TRYOUT_SET_SLUG_REGEX =
  /^exercises\/[^/]+\/[^/]+\/[^/]+\/try-out\/(\d{4})\/[^/]+$/;

function getSnbtCycleKeyFromSetSlug(setSlug: Doc<"exerciseSets">["slug"]) {
  const match = setSlug.match(YEARFUL_TRYOUT_SET_SLUG_REGEX);

  if (!match) {
    return null;
  }

  return match[1];
}

function sortSnbtSets(sets: TryoutSetCandidate[]) {
  return [...sets].sort(
    (left, right) =>
      (snbtPartOrder.get(left.material) ?? Number.MAX_SAFE_INTEGER) -
      (snbtPartOrder.get(right.material) ?? Number.MAX_SAFE_INTEGER)
  );
}

function compareSnbtTryouts(left: TryoutRecord, right: TryoutRecord) {
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

      const setsByKey = new Map<string, SnbtTryoutSetCandidate[]>();

      for (const set of candidateSets) {
        const key = `${set.cycleKey}:${set.setName}`;
        const existing = setsByKey.get(key) ?? [];
        existing.push(set);
        setsByKey.set(key, existing);
      }

      const detectedTryouts: DetectedTryout[] = [];

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

/** Builds the aggregate namespace for one product's global leaderboard scope. */
export function getTryoutLeaderboardNamespace(args: {
  cycleKey: TryoutLeaderboardNamespaceArgs["cycleKey"];
  locale: TryoutLeaderboardNamespaceArgs["locale"];
  product: TryoutLeaderboardNamespaceArgs["product"];
}) {
  return tryoutProductPolicies[args.product].getLeaderboardNamespace(args);
}

/** Sorts tryouts with the product-specific ordering policy. */
export function sortTryoutsForProduct<T extends TryoutRecord>(
  product: TryoutProduct,
  tryouts: T[]
) {
  return [...tryouts].sort(tryoutProductPolicies[product].compareTryouts);
}

/** Detects runtime tryouts from synced exercise sets for one product. */
export function detectTryoutsForProduct(args: {
  locale: TryoutSetCandidate["locale"];
  product: TryoutProduct;
  sets: TryoutSetCandidate[];
}) {
  return tryoutProductPolicies[args.product].detectTryouts(args);
}

/** Computes one part's time limit from the active product policy. */
export function computeTryoutPartTimeLimitSeconds(args: {
  product: TryoutProduct;
  questionCount: number;
}) {
  return tryoutProductPolicies[args.product].getPartTimeLimitSeconds(
    args.questionCount
  );
}

/** Computes the absolute tryout expiry timestamp from the product policy. */
export function computeTryoutExpiresAtMs(args: {
  product: TryoutProduct;
  startedAtMs: number;
}) {
  return (
    args.startedAtMs + tryoutProductPolicies[args.product].getAttemptWindowMs()
  );
}

/** Converts an operational theta estimate into the product's displayed score. */
export function scaleThetaToTryoutScore(args: {
  product: TryoutProduct;
  theta: number;
}) {
  return tryoutProductPolicies[args.product].scaleThetaToScore(args.theta);
}
