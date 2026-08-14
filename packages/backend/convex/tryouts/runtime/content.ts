import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
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
  appLocale: appLocaleValidator,
  artifactHash: v.string(),
  contentHash: v.string(),
  contentKey: v.string(),
  questionOrder: v.number(),
  snapshotReleaseId: v.string(),
  snapshotId: v.string(),
  sourcePath: v.string(),
  sourceRevision: v.string(),
};

export const tryoutCurrentQuestionSelectorValidator = v.object({
  ...protectedSelectorFields,
  delivery: v.literal("authenticated"),
});
export type TryoutCurrentQuestionSelector = Infer<
  typeof tryoutCurrentQuestionSelectorValidator
>;

const currentAnswerSelectorValidator = v.object({
  ...protectedSelectorFields,
  delivery: v.literal("entitled"),
});

const historySelectorFields = {
  ...protectedSelectorFields,
  artifactLocale: localeValidator,
};

const historyQuestionSelectorValidator = v.object({
  ...historySelectorFields,
  delivery: v.literal("authenticated"),
});

const historyAnswerSelectorValidator = v.object({
  ...historySelectorFields,
  delivery: v.literal("entitled"),
});

export const tryoutQuestionSelectorValidator = v.union(
  tryoutCurrentQuestionSelectorValidator,
  historyQuestionSelectorValidator
);
export type TryoutQuestionSelector = Infer<
  typeof tryoutQuestionSelectorValidator
>;

export const tryoutAnswerSelectorValidator = v.union(
  currentAnswerSelectorValidator,
  historyAnswerSelectorValidator
);
export type TryoutAnswerSelector = Infer<typeof tryoutAnswerSelectorValidator>;

export const tryoutSectionContentAccessValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({
    answers: v.array(currentAnswerSelectorValidator),
    kind: v.literal("signed"),
    questions: v.array(tryoutCurrentQuestionSelectorValidator),
    runtime: v.literal("current"),
  }),
  v.object({
    answers: v.array(historyAnswerSelectorValidator),
    attemptId: v.id("tryoutAttempts"),
    kind: v.literal("signed"),
    questions: v.array(historyQuestionSelectorValidator),
    runtime: v.literal("history"),
  })
);

export type TryoutSectionContentAccess = Infer<
  typeof tryoutSectionContentAccessValidator
>;

export const noTryoutSectionContentAccess = {
  kind: "none",
} satisfies TryoutSectionContentAccess;

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
