import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/schema";
import {
  tryoutRouteKeyValidator,
  tryoutScoreResultValidator,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
import { v } from "convex/values";

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

export const tryoutSectionContentAccessValidator = v.object({
  answers: v.boolean(),
  questions: v.boolean(),
});

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
