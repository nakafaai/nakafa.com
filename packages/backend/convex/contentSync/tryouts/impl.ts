import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  type AuthorCache,
  buildAuthorCache,
  deleteQuestion,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import type {
  SyncedQuestion,
  SyncedQuestionChoice,
  SyncedQuestionSet,
  SyncedTryoutCountry,
  SyncedTryoutExam,
  SyncedTryoutSection,
  SyncedTryoutSet,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

type SyncOutcome = "created" | "unchanged" | "updated";

interface SyncTotals {
  created: number;
  unchanged: number;
  updated: number;
}

export interface BulkSyncTryoutsArgs {
  countries: SyncedTryoutCountry[];
  exams: SyncedTryoutExam[];
  questionSets: SyncedQuestionSet[];
  questions: SyncedQuestion[];
  sections: SyncedTryoutSection[];
  sets: SyncedTryoutSet[];
}

/** Upserts one bounded try-out catalog and question-bank batch. */
export async function bulkSyncTryoutsImpl(
  ctx: MutationCtx,
  args: BulkSyncTryoutsArgs
) {
  assertTryoutBatchSizes(args);

  const now = Date.now();
  const totals: SyncTotals = { created: 0, unchanged: 0, updated: 0 };

  for (const country of args.countries) {
    addOutcome(totals, await syncCountry(ctx, country, now));
  }
  for (const exam of args.exams) {
    addOutcome(totals, await syncExam(ctx, exam, now));
  }
  for (const set of args.sets) {
    addOutcome(totals, await syncSet(ctx, set, now));
  }
  for (const questionSet of args.questionSets) {
    addOutcome(totals, await syncQuestionSet(ctx, questionSet, now));
  }
  const questionAuthorCache = await buildAuthorCache(
    ctx,
    args.questions.flatMap((question) =>
      question.authors.map((author) => author.name)
    )
  );

  for (const question of args.questions) {
    addOutcome(
      totals,
      await syncQuestion(ctx, question, now, questionAuthorCache)
    );
  }
  for (const section of args.sections) {
    addOutcome(totals, await syncSection(ctx, section, now));
  }

  return totals;
}

/** Deletes one bounded stale question batch with sync-owned choice rows. */
export async function deleteStaleQuestionsImpl(
  ctx: MutationCtx,
  args: { questionIds: Id<"questions">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleQuestions",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleQuestions,
    received: args.questionIds.length,
    unit: "questions",
  });

  for (const questionId of args.questionIds) {
    await deleteQuestion(ctx, questionId);
  }

  return { deleted: args.questionIds.length };
}

/** Deletes one bounded stale question-set batch after its sections are removed. */
export async function deleteStaleQuestionSetsImpl(
  ctx: MutationCtx,
  args: { questionSetIds: Id<"questionSets">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleQuestionSets",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleQuestionSets,
    received: args.questionSetIds.length,
    unit: "question sets",
  });

  let deleted = 0;
  for (const questionSetId of args.questionSetIds) {
    await deleteQuestionSet(ctx, questionSetId);
    deleted++;
  }

  return { deleted };
}

function assertTryoutBatchSizes(args: BulkSyncTryoutsArgs) {
  assertContentSyncBatchSize({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.tryoutSets,
    received:
      args.countries.length +
      args.exams.length +
      args.sets.length +
      args.sections.length,
    unit: "try-out catalog rows",
  });
  assertContentSyncBatchSize({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.questionSets,
    received: args.questionSets.length,
    unit: "question sets",
  });
  assertContentSyncBatchSize({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.questions,
    received: args.questions.length,
    unit: "questions",
  });
}

function addOutcome(totals: SyncTotals, outcome: SyncOutcome) {
  totals[outcome]++;
}

async function syncCountry(
  ctx: MutationCtx,
  country: SyncedTryoutCountry,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("tryoutCountries")
    .withIndex("by_countryKey_and_locale", (q) =>
      q.eq("countryKey", country.countryKey).eq("locale", country.locale)
    )
    .unique();
  const nextValues = { ...country, syncedAt };

  if (hasSameSyncValues(nextValues, existing)) {
    return "unchanged";
  }
  if (existing) {
    await ctx.db.patch("tryoutCountries", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutCountries", nextValues);
  return "created";
}

async function syncExam(
  ctx: MutationCtx,
  exam: SyncedTryoutExam,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("tryoutExams")
    .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
      q
        .eq("countryKey", exam.countryKey)
        .eq("examKey", exam.examKey)
        .eq("locale", exam.locale)
    )
    .unique();
  const nextValues = { ...exam, syncedAt };

  if (hasSameSyncValues(nextValues, existing)) {
    return "unchanged";
  }
  if (existing) {
    await ctx.db.patch("tryoutExams", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutExams", nextValues);
  return "created";
}

async function syncSet(
  ctx: MutationCtx,
  set: SyncedTryoutSet,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("tryoutSets")
    .withIndex("by_countryKey_and_examKey_and_setKey_and_locale", (q) =>
      q
        .eq("countryKey", set.countryKey)
        .eq("examKey", set.examKey)
        .eq("setKey", set.setKey)
        .eq("locale", set.locale)
    )
    .unique();
  const nextValues = { ...set, syncedAt };

  if (hasSameSyncValues(nextValues, existing)) {
    return "unchanged";
  }
  if (existing) {
    await ctx.db.patch("tryoutSets", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutSets", nextValues);
  return "created";
}

async function syncQuestionSet(
  ctx: MutationCtx,
  questionSet: SyncedQuestionSet,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("questionSets")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q
        .eq("locale", questionSet.locale)
        .eq("sourcePath", questionSet.sourcePath)
    )
    .unique();
  const nextValues = { ...questionSet, syncedAt };

  if (hasSameSyncValues(nextValues, existing)) {
    return "unchanged";
  }
  if (existing) {
    await ctx.db.patch("questionSets", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("questionSets", nextValues);
  return "created";
}

async function syncQuestion(
  ctx: MutationCtx,
  question: SyncedQuestion,
  syncedAt: number,
  authorCache: AuthorCache
): Promise<SyncOutcome> {
  const questionSet = await getQuestionSet(ctx, {
    locale: question.locale,
    sourcePath: question.questionSetSourcePath,
  });
  const existing = await ctx.db
    .query("questions")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", question.locale).eq("sourcePath", question.sourcePath)
    )
    .unique();
  const {
    authors,
    choices,
    questionSetSourcePath: _questionSetSourcePath,
    ...values
  } = question;
  const nextValues = { ...values, questionSetId: questionSet._id, syncedAt };

  if (hasSameSyncValues(nextValues, existing)) {
    if (existing) {
      await replaceQuestionChoicesForLocale(
        ctx,
        existing._id,
        question.locale,
        choices
      );
      await syncContentAuthorsWithCache(
        ctx,
        existing._id,
        "question",
        authors,
        authorCache
      );
    }
    return "unchanged";
  }
  if (existing) {
    await ctx.db.patch("questions", existing._id, nextValues);
    await replaceQuestionChoicesForLocale(
      ctx,
      existing._id,
      question.locale,
      choices
    );
    await syncContentAuthorsWithCache(
      ctx,
      existing._id,
      "question",
      authors,
      authorCache
    );
    return "updated";
  }

  const questionId = await ctx.db.insert("questions", nextValues);
  await replaceQuestionChoicesForLocale(
    ctx,
    questionId,
    question.locale,
    choices
  );
  await syncContentAuthorsWithCache(
    ctx,
    questionId,
    "question",
    authors,
    authorCache
  );
  return "created";
}

async function syncSection(
  ctx: MutationCtx,
  section: SyncedTryoutSection,
  syncedAt: number
): Promise<SyncOutcome> {
  const [tryoutSet, questionSet] = await Promise.all([
    getTryoutSet(ctx, section),
    getQuestionSet(ctx, {
      locale: section.locale,
      sourcePath: section.questionSourcePath,
    }),
  ]);
  const existing = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_sectionKey", (q) =>
      q.eq("tryoutSetId", tryoutSet._id).eq("sectionKey", section.sectionKey)
    )
    .unique();
  const nextValues = {
    ...section,
    questionSetId: questionSet._id,
    tryoutSetId: tryoutSet._id,
    syncedAt,
  };

  if (hasSameSyncValues(nextValues, existing)) {
    return "unchanged";
  }
  if (existing) {
    await ctx.db.patch("tryoutSections", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutSections", nextValues);
  return "created";
}

async function getTryoutSet(
  ctx: MutationCtx,
  section: Pick<
    SyncedTryoutSection,
    "countryKey" | "examKey" | "locale" | "setKey"
  >
) {
  const tryoutSet = await ctx.db
    .query("tryoutSets")
    .withIndex("by_countryKey_and_examKey_and_setKey_and_locale", (q) =>
      q
        .eq("countryKey", section.countryKey)
        .eq("examKey", section.examKey)
        .eq("setKey", section.setKey)
        .eq("locale", section.locale)
    )
    .unique();

  if (!tryoutSet) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_SET_NOT_FOUND",
      message: `Missing try-out set ${section.countryKey}/${section.examKey}/${section.setKey}/${section.locale}.`,
    });
  }

  return tryoutSet;
}

async function getQuestionSet(
  ctx: MutationCtx,
  source: { locale: Locale; sourcePath: string }
) {
  const questionSet = await ctx.db
    .query("questionSets")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", source.locale).eq("sourcePath", source.sourcePath)
    )
    .unique();

  if (!questionSet) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_QUESTION_SET_NOT_FOUND",
      message: `Missing question set ${source.locale}:${source.sourcePath}.`,
    });
  }

  return questionSet;
}

async function replaceQuestionChoicesForLocale(
  ctx: MutationCtx,
  questionId: Id<"questions">,
  locale: Locale,
  choices: SyncedQuestionChoice[]
) {
  assertContentSyncBatchSize({
    functionName: "replaceQuestionChoicesForLocale",
    limit: CONTENT_SYNC_BATCH_LIMITS.questionChoices,
    received: choices.length,
    unit: `${locale} question choices`,
  });

  const existingChoices = await ctx.db
    .query("questionChoices")
    .withIndex("by_questionId_and_locale", (q) =>
      q.eq("questionId", questionId).eq("locale", locale)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.questionChoices + 1);

  if (existingChoices.length > CONTENT_SYNC_BATCH_LIMITS.questionChoices) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_CHOICE_LIMIT_EXCEEDED",
      message: "Existing question choice count exceeds the safe sync limit.",
    });
  }

  for (const choice of existingChoices) {
    await ctx.db.delete(choice._id);
  }
  for (const choice of choices) {
    await ctx.db.insert("questionChoices", {
      ...choice,
      locale,
      questionId,
    });
  }
}

async function deleteQuestionSet(
  ctx: MutationCtx,
  questionSetId: Id<"questionSets">
) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (q) =>
      q.eq("questionSetId", questionSetId)
    )
    .take(1);

  if (questions.length > 0) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_QUESTION_SET_NOT_EMPTY",
      message: "Delete stale questions before deleting their question set.",
    });
  }

  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_questionSetId", (q) => q.eq("questionSetId", questionSetId))
    .take(CONTENT_SYNC_BATCH_LIMITS.tryoutSets + 1);

  if (sections.length > CONTENT_SYNC_BATCH_LIMITS.tryoutSets) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_SECTION_DELETE_LIMIT_EXCEEDED",
      message: "Question set has too many try-out sections to delete safely.",
    });
  }

  for (const section of sections) {
    await ctx.db.delete(section._id);
  }
  await ctx.db.delete("questionSets", questionSetId);
}
