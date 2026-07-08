import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  tryoutRouteKeyValidator,
  tryoutScoringStrategyValidator,
  tryoutSectionVisibilityValidator,
  tryoutTrackKindValidator,
} from "@repo/backend/convex/tryouts/schema";
import { readTryoutCountryCode } from "@repo/contents/_types/tryout/countries";
import { ConvexError, v } from "convex/values";

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
  internalEntrySectionKey: v.optional(tryoutRouteKeyValidator),
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

export const publicTryoutQuestionContentValidator = v.object({
  contentHash: v.string(),
  questionOrder: v.number(),
  sourcePath: v.string(),
  sourceRevision: v.string(),
});

/** Returns the source-owned ISO country code for a try-out country key. */
export function readSourceCountryCode(countryKey: string) {
  const countryCode = readTryoutCountryCode(countryKey);

  if (!countryCode) {
    throw new ConvexError({
      code: "TRYOUT_COUNTRY_SOURCE_NOT_FOUND",
      message: "Try-out country source not found.",
    });
  }

  return countryCode;
}

/** Projects a country document into the public catalog row contract. */
export function toPublicTryoutCountry(country: Doc<"tryoutCountries">) {
  return {
    countryCode: readSourceCountryCode(country.countryKey),
    countryKey: country.countryKey,
    description: country.description,
    publicPath: country.publicPath,
    title: country.title,
  };
}

/** Projects an exam document into the public catalog row contract. */
export function toPublicTryoutExam(exam: Doc<"tryoutExams">) {
  return {
    description: exam.description,
    examKey: exam.examKey,
    publicPath: exam.publicPath,
    scoringStrategy: exam.scoringStrategy,
    title: exam.title,
  };
}

/** Projects a track document into the public catalog row contract. */
export function toPublicTryoutTrack(track: Doc<"tryoutTracks">) {
  return {
    description: track.description,
    publicPath: track.publicPath,
    readyQuestionCount: track.readyQuestionCount,
    readySetCount: track.readySetCount,
    readyVisibleSectionCount: track.readyVisibleSectionCount,
    title: track.title,
    trackKey: track.trackKey,
    trackKind: track.trackKind,
  };
}

/** Projects a set document into the public catalog row contract. */
export function toPublicTryoutSet(set: Doc<"tryoutSets">) {
  return {
    countryKey: set.countryKey,
    description: set.description,
    examKey: set.examKey,
    internalEntrySectionKey: set.internalEntrySectionKey,
    publicPath: set.publicPath,
    readyQuestionCount: set.readyQuestionCount,
    readyVisibleSectionCount: set.readyVisibleSectionCount,
    scoringStrategy: set.scoringStrategy,
    sectionCount: set.sectionCount,
    setKey: set.setKey,
    title: set.title,
    totalQuestionCount: set.totalQuestionCount,
    trackKey: set.trackKey,
    visibleSectionCount: set.visibleSectionCount,
  };
}

/** Projects a section document into the public catalog row contract. */
export function toPublicTryoutSection(section: Doc<"tryoutSections">) {
  return {
    description: section.description,
    publicPath: section.publicPath,
    questionCount: section.questionCount,
    sectionKey: section.sectionKey,
    timeLimitSeconds: section.timeLimitSeconds,
    title: section.title,
    visibility: section.visibility,
  };
}

/** Loads bounded public question content keys for server-side MDX rendering. */
export async function loadQuestionContentRows(
  ctx: QueryCtx,
  section: Doc<"tryoutSections">
) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (q) =>
      q.eq("questionSetId", section.questionSetId)
    )
    .take(section.questionCount + 1);

  if (questions.length !== section.questionCount) {
    throw new ConvexError({
      code: "TRYOUT_QUESTION_COUNT_MISMATCH",
      message: "Try-out section question count is not synced.",
    });
  }

  return questions.map((question) => ({
    contentHash: question.contentHash,
    questionOrder: question.number,
    sourcePath: question.sourcePath,
    sourceRevision: question.sourceRevision,
  }));
}

/** Returns ordered section rows only when they match the set snapshot. */
export async function loadReadySections(ctx: QueryCtx, set: Doc<"tryoutSets">) {
  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_order", (q) => q.eq("tryoutSetId", set._id))
    .take(set.sectionCount + 1);

  if (sections.length !== set.sectionCount) {
    return null;
  }

  const totalQuestionCount = sections.reduce(
    (total, section) => total + section.questionCount,
    0
  );
  const hasMixedRevision = sections.some(
    (section) => section.sourceRevision !== set.sourceRevision
  );

  if (totalQuestionCount !== set.totalQuestionCount || hasMixedRevision) {
    return null;
  }

  return sections;
}
