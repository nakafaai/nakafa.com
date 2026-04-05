import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { TryoutPartKey } from "@repo/backend/convex/tryouts/schema";
import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";
import { snbtTryoutProductPolicy } from "./snbt";

export const tryoutProducts = ["snbt"] as const;

const tryoutProductSet = new Set<string>(tryoutProducts);

export const tryoutProductValidator = literals(...tryoutProducts);

export type TryoutProduct = Infer<typeof tryoutProductValidator>;

/** Checks whether a route/product string is one of the supported tryout products. */
export function isTryoutProduct(value: string): value is TryoutProduct {
  return tryoutProductSet.has(value);
}

export type TryoutSetCandidate = Pick<
  Doc<"exerciseSets">,
  | "_id"
  | "exerciseType"
  | "locale"
  | "material"
  | "questionCount"
  | "setName"
  | "title"
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
  parts: Array<{
    partKey: TryoutPartKey;
    setId: Id<"exerciseSets">;
  }>;
};

type TryoutRecord = Pick<Doc<"tryouts">, "cycleKey" | "label" | "slug">;

type TryoutLeaderboardNamespaceArgs = Pick<
  Doc<"tryouts">,
  "cycleKey" | "locale" | "product"
>;

export interface TryoutProductPolicy {
  attemptWindowMs: number;
  compareTryouts: (left: TryoutRecord, right: TryoutRecord) => number;
  detectTryouts: (args: {
    locale: TryoutSetCandidate["locale"];
    sets: TryoutSetCandidate[];
  }) => DetectedTryout[];
  getLeaderboardNamespace: (args: TryoutLeaderboardNamespaceArgs) => string;
  getPartTimeLimitSeconds: (
    questionCount: Doc<"exerciseSets">["questionCount"]
  ) => number;
  scaleThetaToScore: (theta: Doc<"tryoutAttempts">["theta"]) => number;
}

export const tryoutProductPolicies = {
  snbt: snbtTryoutProductPolicy,
} satisfies Record<TryoutProduct, TryoutProductPolicy>;
