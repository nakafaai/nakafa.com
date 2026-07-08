import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  type AuthorCache,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import type {
  SyncedQuestion,
  SyncedQuestionChoice,
  SyncedQuestionSet,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

/** Upserts one try-out question-set source row. */
export async function syncQuestionSet(
  ctx: MutationCtx,
  questionSet: SyncedQuestionSet,
  syncedAt: number
) {
  const existing = await ctx.db
    .query("questionSets")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q
        .eq("locale", questionSet.locale)
        .eq("sourcePath", questionSet.sourcePath)
    )
    .unique();

  if (hasSameDescribedValues(questionSet, existing)) {
    return "unchanged";
  }

  const nextValues = { ...questionSet, syncedAt };

  if (existing) {
    await ctx.db.replace("questionSets", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("questionSets", nextValues);
  return "created";
}

/** Upserts one try-out question and replaces its locale-scoped choices. */
export async function syncQuestion(
  ctx: MutationCtx,
  question: SyncedQuestion,
  syncedAt: number,
  authorCache: AuthorCache
) {
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
  const nextValues = { ...values, questionSetId: questionSet._id };

  if (hasSameDescribedValues(nextValues, existing)) {
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

  const writeValues = { ...nextValues, syncedAt };

  if (existing) {
    await ctx.db.replace("questions", existing._id, writeValues);
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

  const questionId = await ctx.db.insert("questions", writeValues);
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

/** Loads the source question-set row required before question sync. */
export async function getQuestionSet(
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

/** Checks source-owned optional fields that can disappear between sync runs. */
function hasSameDescribedValues<TValues extends { description?: string }>(
  nextValues: TValues,
  existing: Partial<TValues> | null | undefined
) {
  return (
    hasSameSyncValues(nextValues, existing) &&
    existing?.description === nextValues.description
  );
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
