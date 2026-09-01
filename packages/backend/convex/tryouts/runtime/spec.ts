import {
  tryoutResponseSelectionValidator,
  tryoutRuntimeResponseSpecValidator,
} from "@repo/backend/convex/tryouts/response/model";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutCurrentSectionValidator } from "@repo/backend/convex/tryouts/runtime/content";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import { v } from "convex/values";

export const tryoutAttemptStateValidator = v.object({
  activeSectionKey: v.union(tryoutRouteKeyValidator, v.null()),
  attemptId: v.id("tryoutAttempts"),
  attemptNumber: v.number(),
  completedSectionKeys: v.array(tryoutRouteKeyValidator),
  expiresAt: v.number(),
  resumeSectionPublicPath: v.union(v.string(), v.null()),
  resumeSectionKey: v.union(tryoutRouteKeyValidator, v.null()),
  score: v.union(tryoutScoreResultValidator, v.null()),
  section: v.union(tryoutCurrentSectionValidator, v.null()),
  startedAt: v.number(),
  status: tryoutStatusValidator,
});

const runtimeResponseValidator = v.object({
  answeredAt: v.number(),
  isComplete: v.boolean(),
  selection: tryoutResponseSelectionValidator,
  updatedAt: v.number(),
});

const runtimeQuestionValidator = v.object({
  contentHash: v.string(),
  placementId: v.id("tryoutAttemptPlacements"),
  questionOrder: v.number(),
  response: v.union(runtimeResponseValidator, v.null()),
  responseSpec: tryoutRuntimeResponseSpecValidator,
  sourcePath: v.string(),
  sourceRevision: v.string(),
});

export const tryoutSectionRuntimeValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  expiresAt: v.number(),
  questions: v.array(runtimeQuestionValidator),
  section: tryoutCurrentSectionValidator,
});

export const tryoutRuntimeStateValidator = v.object({
  attempt: tryoutAttemptStateValidator,
  runtime: v.union(v.null(), tryoutSectionRuntimeValidator),
});
