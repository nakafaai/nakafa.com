import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import {
  type TryoutStatus,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/status";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

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

const selectorFields = {
  appLocale: appLocaleValidator,
  artifactHash: v.string(),
  bundleHash: v.string(),
  contentHash: v.string(),
  contentKey: v.string(),
  questionOrder: v.number(),
  sectionKey: tryoutRouteKeyValidator,
  snapshotReleaseId: v.string(),
  snapshotId: v.string(),
  sourcePath: v.string(),
  sourceRevision: v.string(),
};

export const tryoutQuestionSelectorValidator = v.object({
  ...selectorFields,
  delivery: v.literal("authenticated"),
});
export type TryoutQuestionSelector = Infer<
  typeof tryoutQuestionSelectorValidator
>;

export const tryoutAnswerSelectorValidator = v.object({
  ...selectorFields,
  delivery: v.literal("entitled"),
});
export type TryoutAnswerSelector = Infer<typeof tryoutAnswerSelectorValidator>;

export const tryoutSectionContentAccessValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({
    answers: v.array(tryoutAnswerSelectorValidator),
    kind: v.literal("signed"),
    questions: v.array(tryoutQuestionSelectorValidator),
  })
);

export type TryoutSectionContentAccess = Infer<
  typeof tryoutSectionContentAccessValidator
>;

export const noTryoutSectionContentAccess = {
  kind: "none",
} satisfies TryoutSectionContentAccess;

/** Derives question and answer access from one coherent attempt lifecycle. */
function getTryoutSectionContentAccess(
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

/** Resolves lifecycle access and the current billing-owned Pro plan together. */
export const readTryoutSectionContentAccess = Effect.fn(
  "tryouts.content.readAccess"
)(function* (
  ctx: QueryCtx,
  attempt: Doc<"tryoutAttempts">,
  sectionStatus: TryoutStatus
) {
  const access = getTryoutSectionContentAccess(attempt.status, sectionStatus);
  if (!access.answers) {
    return access;
  }
  const user = yield* tryRuntimePromise(() =>
    ctx.db.get("users", attempt.userId)
  );
  if (!user) {
    return { answers: false, questions: false };
  }
  return { ...access, answers: user.plan === "pro" };
});
