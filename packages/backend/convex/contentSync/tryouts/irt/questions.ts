import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import type { BulkSyncTryoutsArgs } from "@repo/backend/convex/contentSync/tryouts/impl";
import type {
  SyncedQuestion,
  SyncedTryoutSection,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { tryoutSnapshotFail } from "@repo/backend/convex/tryouts/snapshot/spec";
import { Effect } from "effect";

type QuestionSource = Pick<
  Doc<"questions">,
  | "contentHash"
  | "locale"
  | "number"
  | "sourceKey"
  | "sourcePath"
  | "sourceRevision"
  | "title"
>;
type SectionSource = Pick<
  SyncedTryoutSection,
  | "countryKey"
  | "examKey"
  | "locale"
  | "questionCount"
  | "questionSourcePath"
  | "sectionKey"
  | "setKey"
  | "sourceRevision"
>;

/** Exact synchronized question and choices matched to one signed placement. */
export interface IrtQuestionEvidence {
  readonly choices: SyncedQuestion["choices"];
  readonly question: QuestionSource;
}

/** Loads one section's exact effective questions and ordered choices. */
export const loadIrtQuestions = Effect.fn("tryouts.irt.loadQuestions")(
  function* (
    ctx: MutationCtx,
    args: BulkSyncTryoutsArgs,
    section: SectionSource
  ) {
    const questionSet = yield* Effect.promise(() =>
      ctx.db
        .query("questionSets")
        .withIndex("by_locale_and_sourcePath", (query) =>
          query
            .eq("locale", section.locale)
            .eq("sourcePath", section.questionSourcePath)
        )
        .unique()
    );
    const incomingSet = args.questionSets.find(
      (row) =>
        row.locale === section.locale &&
        row.sourcePath === section.questionSourcePath
    );
    const set = incomingSet ?? questionSet;
    if (
      !set ||
      set.countryKey !== section.countryKey ||
      set.examKey !== section.examKey ||
      set.setKey !== section.setKey ||
      set.sectionKey !== section.sectionKey ||
      set.questionCount !== section.questionCount ||
      set.sourceRevision !== section.sourceRevision
    ) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_IRT_QUESTION_SET_MISMATCH",
        `IRT section ${section.sectionKey} lost its exact question set.`
      );
    }
    const existing = questionSet
      ? yield* Effect.promise(() =>
          ctx.db
            .query("questions")
            .withIndex("by_questionSetId_and_number", (query) =>
              query.eq("questionSetId", questionSet._id)
            )
            .take(section.questionCount + 1)
        )
      : [];
    const incoming = args.questions.filter(
      (question) =>
        question.locale === section.locale &&
        question.questionSetSourcePath === section.questionSourcePath
    );
    const questions = overlayQuestions(existing, incoming);
    if (questions.length !== section.questionCount) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_IRT_QUESTION_COUNT_MISMATCH",
        `IRT section ${section.sectionKey} does not have its exact question count.`
      );
    }
    return yield* Effect.forEach(questions, (question) =>
      loadChoices(ctx, incoming, question)
    );
  }
);

/** Loads source choices from the incoming row or exact synchronized question. */
const loadChoices = Effect.fn("tryouts.irt.loadChoices")(function* (
  ctx: MutationCtx,
  incoming: readonly SyncedQuestion[],
  question: QuestionSource & { readonly _id?: Doc<"questions">["_id"] }
) {
  const synced = incoming.find(
    (candidate) =>
      candidate.locale === question.locale &&
      candidate.sourcePath === question.sourcePath
  );
  if (synced) {
    return {
      choices: synced.choices,
      question,
    } satisfies IrtQuestionEvidence;
  }
  if (!question._id) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_IRT_QUESTION_MISSING",
      `IRT question ${question.sourceKey} is not synchronized.`
    );
  }
  const questionId = question._id;
  const choices = yield* Effect.promise(() =>
    ctx.db
      .query("questionChoices")
      .withIndex("by_questionId_and_locale", (query) =>
        query.eq("questionId", questionId).eq("locale", question.locale)
      )
      .take(CONTENT_SYNC_BATCH_LIMITS.questionChoices + 1)
  );
  if (
    choices.length === 0 ||
    choices.length > CONTENT_SYNC_BATCH_LIMITS.questionChoices
  ) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_IRT_CHOICE_COUNT_MISMATCH",
      `IRT question ${question.sourceKey} has an invalid choice count.`
    );
  }
  return {
    choices: choices.map(({ isCorrect, label, optionKey, order }) => ({
      isCorrect,
      label,
      optionKey,
      order,
    })),
    question,
  } satisfies IrtQuestionEvidence;
});

/** Overlays source questions by number and returns deterministic order. */
function overlayQuestions(
  existing: readonly Doc<"questions">[],
  incoming: readonly SyncedQuestion[]
) {
  const byNumber = new Map<
    number,
    QuestionSource & { readonly _id?: Doc<"questions">["_id"] }
  >(existing.map((question) => [question.number, question]));
  for (const question of incoming) {
    byNumber.set(question.number, question);
  }
  return [...byNumber.values()].sort(
    (left, right) => left.number - right.number
  );
}
