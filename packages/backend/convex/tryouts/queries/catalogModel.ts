import {
  tryoutSectionVisibilityValidator,
  tryoutTrackKindValidator,
} from "@repo/backend/convex/tryouts/catalog/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutScoringStrategyValidator } from "@repo/backend/convex/tryouts/score";
import { v } from "convex/values";

export const publicTryoutCountryValidator = v.object({
  countryCode: v.string(),
  countryKey: tryoutRouteKeyValidator,
  description: v.optional(v.string()),
  publicPath: v.string(),
  title: v.string(),
});

export const publicTryoutCountryWithExamCountValidator = v.object({
  ...publicTryoutCountryValidator.fields,
  examCount: v.number(),
});

export const publicTryoutExamValidator = v.object({
  description: v.optional(v.string()),
  examKey: tryoutRouteKeyValidator,
  publicPath: v.string(),
  scoringStrategy: tryoutScoringStrategyValidator,
  title: v.string(),
});

export const publicTryoutSetValidator = v.object({
  countryKey: tryoutRouteKeyValidator,
  description: v.optional(v.string()),
  examKey: tryoutRouteKeyValidator,
  publicPath: v.string(),
  readyQuestionCount: v.number(),
  readyVisibleSectionCount: v.number(),
  scoringStrategy: tryoutScoringStrategyValidator,
  sectionCount: v.number(),
  setKey: tryoutRouteKeyValidator,
  title: v.string(),
  totalQuestionCount: v.number(),
  trackKey: tryoutRouteKeyValidator,
  visibleSectionCount: v.number(),
});

export const publicTryoutTrackValidator = v.object({
  description: v.optional(v.string()),
  publicPath: v.string(),
  readyQuestionCount: v.number(),
  readySetCount: v.number(),
  readyVisibleSectionCount: v.number(),
  title: v.string(),
  trackKey: tryoutRouteKeyValidator,
  trackKind: tryoutTrackKindValidator,
});

export const publicTryoutSectionValidator = v.object({
  description: v.optional(v.string()),
  publicPath: v.optional(v.string()),
  questionCount: v.number(),
  sectionKey: tryoutRouteKeyValidator,
  timeLimitSeconds: v.number(),
  title: v.string(),
  visibility: tryoutSectionVisibilityValidator,
});
