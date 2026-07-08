import { syncedAuthorValidator } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { TRYOUT_ROUTE_KIND_VALUES } from "@repo/contents/_types/tryout/schema";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

const tryoutCatalogRowValidator = v.object({
  countryKey: v.string(),
  description: v.optional(v.string()),
  isActive: v.boolean(),
  locale: localeValidator,
  order: v.number(),
  publicPath: v.string(),
  sourceRevision: v.string(),
  title: v.string(),
});

const tryoutScoringStrategyValidator = v.union(
  v.literal("irt"),
  v.literal("raw"),
  v.literal("weighted")
);

const tryoutTrackKindValidator = v.union(
  v.literal("subject"),
  v.literal("year")
);

const tryoutSectionVisibilityValidator = v.union(
  v.literal("internal-entry"),
  v.literal("visible")
);

export const syncedTryoutCountryValidator = tryoutCatalogRowValidator;

export const syncedTryoutExamValidator = v.object({
  ...tryoutCatalogRowValidator.fields,
  examKey: v.string(),
  scoringStrategy: tryoutScoringStrategyValidator,
});

export const syncedTryoutTrackValidator = v.object({
  ...tryoutCatalogRowValidator.fields,
  authoredSetCount: v.number(),
  examKey: v.string(),
  isReady: v.boolean(),
  readyQuestionCount: v.number(),
  readySetCount: v.number(),
  readyVisibleSectionCount: v.number(),
  trackKey: v.string(),
  trackKind: tryoutTrackKindValidator,
});

export const syncedTryoutSetValidator = v.object({
  ...syncedTryoutExamValidator.fields,
  internalEntrySectionKey: v.optional(v.string()),
  isReady: v.boolean(),
  readyQuestionCount: v.number(),
  readyVisibleSectionCount: v.number(),
  sectionCount: v.number(),
  setKey: v.string(),
  trackKey: v.string(),
  totalQuestionCount: v.number(),
  visibleSectionCount: v.number(),
});

export const syncedQuestionSetValidator = v.object({
  contentHash: v.string(),
  countryKey: v.string(),
  description: v.optional(v.string()),
  examKey: v.string(),
  locale: localeValidator,
  questionCount: v.number(),
  sectionKey: v.string(),
  setKey: v.string(),
  sourcePath: v.string(),
  sourceRevision: v.string(),
  title: v.string(),
});

export const syncedTryoutSectionValidator = v.object({
  countryKey: v.string(),
  description: v.optional(v.string()),
  examKey: v.string(),
  locale: localeValidator,
  order: v.number(),
  publicPath: v.optional(v.string()),
  questionCount: v.number(),
  questionSourcePath: v.string(),
  sectionKey: v.string(),
  setKey: v.string(),
  sourceRevision: v.string(),
  timeLimitSeconds: v.number(),
  title: v.string(),
  trackKey: v.string(),
  visibility: tryoutSectionVisibilityValidator,
});

export const syncedTryoutRouteValidator = v.object({
  contentHash: v.string(),
  description: v.optional(v.string()),
  kind: literals(...TRYOUT_ROUTE_KIND_VALUES),
  locale: localeValidator,
  publicPath: v.string(),
  sourcePath: v.string(),
  title: v.string(),
});

export const syncedQuestionChoiceValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

export const syncedQuestionValidator = v.object({
  answerBody: v.string(),
  authors: v.array(syncedAuthorValidator),
  choices: v.array(syncedQuestionChoiceValidator),
  contentHash: v.string(),
  date: v.number(),
  description: v.optional(v.string()),
  locale: localeValidator,
  number: v.number(),
  questionBody: v.string(),
  questionSetSourcePath: v.string(),
  sourceKey: v.string(),
  sourcePath: v.string(),
  sourceRevision: v.string(),
  title: v.string(),
});

export const bulkSyncTryoutsResultValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

export const deleteResultValidator = v.object({
  deleted: v.number(),
});

export type SyncedTryoutCountry = Infer<typeof syncedTryoutCountryValidator>;
export type SyncedTryoutExam = Infer<typeof syncedTryoutExamValidator>;
export type SyncedTryoutTrack = Infer<typeof syncedTryoutTrackValidator>;
export type SyncedTryoutRoute = Infer<typeof syncedTryoutRouteValidator>;
export type SyncedTryoutSet = Infer<typeof syncedTryoutSetValidator>;
export type SyncedQuestionSet = Infer<typeof syncedQuestionSetValidator>;
export type SyncedTryoutSection = Infer<typeof syncedTryoutSectionValidator>;
export type SyncedQuestion = Infer<typeof syncedQuestionValidator>;
export type SyncedQuestionChoice = Infer<typeof syncedQuestionChoiceValidator>;
