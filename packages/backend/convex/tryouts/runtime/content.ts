import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import {
  type TryoutStatus,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/status";
import { type Infer, v } from "convex/values";

export const tryoutCurrentSectionValidator = v.object({
  answeredCount: v.number(),
  completedAt: v.union(v.number(), v.null()),
  endReason: v.union(attemptEndReasonValidator, v.null()),
  expiresAt: v.number(),
  score: v.union(tryoutScoreResultValidator, v.null()),
  sectionKey: tryoutRouteKeyValidator,
  startedAt: v.number(),
  status: tryoutStatusValidator,
  totalQuestions: v.number(),
});

const protectedSelectorFields = {
  artifactHash: v.string(),
  contentHash: v.string(),
  contentKey: v.string(),
  locale: v.union(v.literal("en"), v.literal("id")),
  questionOrder: v.number(),
  snapshotId: v.string(),
  sourcePath: v.string(),
  sourceRevision: v.string(),
};

export const tryoutSectionContentArgs = {
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: localeValidator,
  sectionKey: tryoutRouteKeyValidator,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
};

const tryoutSectionContentArgsValidator = v.object(tryoutSectionContentArgs);
export type TryoutSectionContentArgs = Infer<
  typeof tryoutSectionContentArgsValidator
>;

export const tryoutQuestionSelectorValidator = v.object({
  ...protectedSelectorFields,
  delivery: v.literal("authenticated"),
});
export type TryoutQuestionSelector = Infer<
  typeof tryoutQuestionSelectorValidator
>;

export const tryoutAnswerSelectorValidator = v.object({
  ...protectedSelectorFields,
  delivery: v.literal("entitled"),
});
export type TryoutAnswerSelector = Infer<typeof tryoutAnswerSelectorValidator>;

export const tryoutSectionContentAccessValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({
    answers: v.boolean(),
    kind: v.literal("filesystem"),
    questions: v.boolean(),
  }),
  v.object({
    answers: v.array(tryoutAnswerSelectorValidator),
    kind: v.literal("signed"),
    questions: v.array(tryoutQuestionSelectorValidator),
  })
);

export type TryoutSectionContentAccess = Infer<
  typeof tryoutSectionContentAccessValidator
>;

/** Derives question and answer access from one coherent attempt lifecycle. */
export function getTryoutSectionContentAccess(
  attemptStatus: TryoutStatus,
  sectionStatus: TryoutStatus
) {
  const isActive =
    attemptStatus === "in-progress" && sectionStatus === "in-progress";
  const isReview =
    attemptStatus !== "in-progress" && sectionStatus !== "in-progress";

  return {
    answers: isReview,
    questions: isActive || isReview,
  };
}
