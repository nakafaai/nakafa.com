import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";
import { snbtTryoutProductPolicy } from "./snbt";

export const tryoutProducts = ["snbt"] as const;

export const tryoutProductValidator = literals(...tryoutProducts);

export type TryoutProduct = Infer<typeof tryoutProductValidator>;

export type TryoutSetCandidate = Pick<
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

export type DetectedTryout = Pick<
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

const tryoutProductPolicies = {
  snbt: snbtTryoutProductPolicy,
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
