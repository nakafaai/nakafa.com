import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  type AuthorCache,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import {
  tryoutSyncFail,
  validateTryoutBatch,
} from "@repo/backend/convex/contentSync/tryouts/error";
import type {
  SyncedQuestion,
  SyncedQuestionChoice,
  SyncedQuestionSet,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import {
  TRYOUT_CREATED,
  TRYOUT_UNCHANGED,
  TRYOUT_UPDATED,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { Effect } from "effect";

/** Upserts one try-out question-set source row. */
export const syncQuestionSet = Effect.fn("contentSync.tryout.syncQuestionSet")(
  function* (
    ctx: MutationCtx,
    questionSet: SyncedQuestionSet,
    syncedAt: number
  ) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("questionSets")
        .withIndex("by_locale_and_sourcePath", (query) =>
          query
            .eq("locale", questionSet.locale)
            .eq("sourcePath", questionSet.sourcePath)
        )
        .unique()
    );

    if (hasSameDescribedValues(questionSet, existing)) {
      return TRYOUT_UNCHANGED;
    }

    const nextValues = { ...questionSet, syncedAt };

    if (existing) {
      yield* Effect.promise(() =>
        ctx.db.replace("questionSets", existing._id, nextValues)
      );
      return TRYOUT_UPDATED;
    }

    yield* Effect.promise(() => ctx.db.insert("questionSets", nextValues));
    return TRYOUT_CREATED;
  }
);

/** Upserts one try-out question and replaces its locale-scoped choices. */
export const syncQuestion = Effect.fn("contentSync.tryout.syncQuestion")(
  function* (
    ctx: MutationCtx,
    question: SyncedQuestion,
    syncedAt: number,
    authorCache: AuthorCache
  ) {
    const questionSet = yield* getQuestionSet(ctx, {
      locale: question.locale,
      sourcePath: question.questionSetSourcePath,
    });
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("questions")
        .withIndex("by_locale_and_sourcePath", (query) =>
          query
            .eq("locale", question.locale)
            .eq("sourcePath", question.sourcePath)
        )
        .unique()
    );
    const {
      authors,
      choices,
      questionSetSourcePath: _questionSetSourcePath,
      ...values
    } = question;
    const nextValues = { ...values, questionSetId: questionSet._id };

    if (hasSameDescribedValues(nextValues, existing)) {
      if (existing) {
        yield* replaceQuestionChoicesForLocale(
          ctx,
          existing._id,
          question.locale,
          choices
        );
        yield* Effect.promise(() =>
          syncContentAuthorsWithCache(
            ctx,
            existing._id,
            "question",
            authors,
            authorCache
          )
        );
      }
      return TRYOUT_UNCHANGED;
    }

    const writeValues = { ...nextValues, syncedAt };

    if (existing) {
      yield* Effect.promise(() =>
        ctx.db.replace("questions", existing._id, writeValues)
      );
      yield* replaceQuestionChoicesForLocale(
        ctx,
        existing._id,
        question.locale,
        choices
      );
      yield* Effect.promise(() =>
        syncContentAuthorsWithCache(
          ctx,
          existing._id,
          "question",
          authors,
          authorCache
        )
      );
      return TRYOUT_UPDATED;
    }

    const questionId = yield* Effect.promise(() =>
      ctx.db.insert("questions", writeValues)
    );
    yield* replaceQuestionChoicesForLocale(
      ctx,
      questionId,
      question.locale,
      choices
    );
    yield* Effect.promise(() =>
      syncContentAuthorsWithCache(
        ctx,
        questionId,
        "question",
        authors,
        authorCache
      )
    );
    return TRYOUT_CREATED;
  }
);

/** Loads the source question-set row required before question sync. */
export const getQuestionSet = Effect.fn("contentSync.tryout.getQuestionSet")(
  function* (ctx: MutationCtx, source: { locale: Locale; sourcePath: string }) {
    const questionSet = yield* Effect.promise(() =>
      ctx.db
        .query("questionSets")
        .withIndex("by_locale_and_sourcePath", (query) =>
          query.eq("locale", source.locale).eq("sourcePath", source.sourcePath)
        )
        .unique()
    );

    if (!questionSet) {
      return yield* tryoutSyncFail(
        "TRYOUT_SYNC_QUESTION_SET_NOT_FOUND",
        `Missing question set ${source.locale}:${source.sourcePath}.`
      );
    }

    return questionSet;
  }
);

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

/** Replace the bounded localized choice set for one synchronized question. */
const replaceQuestionChoicesForLocale = Effect.fn(
  "contentSync.tryout.replaceQuestionChoices"
)(function* (
  ctx: MutationCtx,
  questionId: Id<"questions">,
  locale: Locale,
  choices: SyncedQuestionChoice[]
) {
  yield* validateTryoutBatch({
    functionName: "replaceQuestionChoicesForLocale",
    limit: CONTENT_SYNC_BATCH_LIMITS.questionChoices,
    received: choices.length,
    unit: `${locale} question choices`,
  });

  const existingChoices = yield* Effect.promise(() =>
    ctx.db
      .query("questionChoices")
      .withIndex("by_questionId_and_locale", (query) =>
        query.eq("questionId", questionId).eq("locale", locale)
      )
      .take(CONTENT_SYNC_BATCH_LIMITS.questionChoices + 1)
  );

  if (existingChoices.length > CONTENT_SYNC_BATCH_LIMITS.questionChoices) {
    return yield* tryoutSyncFail(
      "TRYOUT_SYNC_CHOICE_LIMIT_EXCEEDED",
      "Existing question choice count exceeds the safe sync limit."
    );
  }

  for (const choice of existingChoices) {
    yield* Effect.promise(() => ctx.db.delete(choice._id));
  }
  for (const choice of choices) {
    yield* Effect.promise(() =>
      ctx.db.insert("questionChoices", {
        ...choice,
        locale,
        questionId,
      })
    );
  }
});
