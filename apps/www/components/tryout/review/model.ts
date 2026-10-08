import { Effect, HashMap, MutableHashSet, Option, Schema } from "effect";
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
  TryoutRuntimeContent,
} from "@/components/tryout/content/model";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

type ReviewContentIdentity = Pick<
  TryoutRuntimeQuestion,
  "contentHash" | "sourcePath" | "sourceRevision"
>;

type ReviewRuntimeQuestion = ReviewContentIdentity &
  Pick<
    TryoutRuntimeQuestion,
    "placementId" | "questionOrder" | "response" | "responseSpec"
  >;

const IdentityJsonSchema = Schema.fromJsonString(Schema.Unknown);

/** Fails closed when signed review content no longer matches frozen runtime. */
export class TryoutReviewProjectionError extends Schema.TaggedError<TryoutReviewProjectionError>()(
  "TryoutReviewProjectionError",
  {
    code: Schema.Literal("TRYOUT_REVIEW_PROJECTION"),
    message: Schema.String,
  }
) {}

/** One immutable reviewed question ready for read-only composition. */
export type TryoutReviewQuestion = ReturnType<
  typeof createTryoutReviewQuestion
>;

/** Pairs one terminal runtime with its exact signed questions and answers. */
export const projectTryoutReview = Effect.fn("TryoutReview.project")(function* <
  Question extends ReviewRuntimeQuestion,
>(input: {
  readonly content: TryoutRuntimeContent;
  readonly questions: readonly Question[];
}) {
  if (
    input.content.questions.length !== input.questions.length ||
    input.content.answers.length !== input.questions.length
  ) {
    return yield* projectionError(
      "Terminal review content count does not match its frozen runtime."
    );
  }

  const questionContent = HashMap.fromIterable(
    input.content.questions.map((question) => [
      getContentIdentity(question),
      question,
    ])
  );
  const answerContent = HashMap.fromIterable(
    input.content.answers.map((answer) => [getContentIdentity(answer), answer])
  );

  if (
    HashMap.size(questionContent) !== input.content.questions.length ||
    HashMap.size(answerContent) !== input.content.answers.length
  ) {
    return yield* projectionError(
      "Terminal review content contains a duplicate frozen identity."
    );
  }

  const questionOrders = MutableHashSet.empty<number>();
  const reviewQuestions: TryoutReviewQuestion[] = [];

  for (const question of input.questions) {
    if (MutableHashSet.has(questionOrders, question.questionOrder)) {
      return yield* projectionError(
        "Terminal review runtime contains a duplicate question order."
      );
    }
    MutableHashSet.add(questionOrders, question.questionOrder);

    const identity = getContentIdentity(question);
    const signedQuestion = HashMap.get(questionContent, identity);
    const signedAnswer = HashMap.get(answerContent, identity);
    if (Option.isNone(signedQuestion) || Option.isNone(signedAnswer)) {
      return yield* projectionError(
        "Terminal review content lost a frozen question or answer."
      );
    }
    if (!signedAnswer.value.answer) {
      return yield* projectionError(
        "Terminal review content contains an empty signed answer."
      );
    }

    reviewQuestions.push(
      createTryoutReviewQuestion(
        question,
        signedQuestion.value,
        signedAnswer.value
      )
    );
  }

  return reviewQuestions;
});

/** Builds one collision-safe key from an already trusted content identity. */
function getContentIdentity(identity: ReviewContentIdentity) {
  return Schema.encodeSync(IdentityJsonSchema)([
    identity.sourcePath,
    identity.contentHash,
    identity.sourceRevision,
  ]);
}

/** Pairs one frozen runtime question with its signed body and answer. */
function createTryoutReviewQuestion(
  question: ReviewRuntimeQuestion,
  signedQuestion: TryoutQuestionContent,
  signedAnswer: TryoutAnswerContent
) {
  return {
    answer: signedAnswer.answer,
    content: signedQuestion.content,
    placementId: question.placementId,
    questionOrder: question.questionOrder,
    response: question.response,
    responseSpec: question.responseSpec,
  };
}

/** Creates one typed terminal-review projection failure. */
function projectionError(message: string) {
  return new TryoutReviewProjectionError({
    code: "TRYOUT_REVIEW_PROJECTION",
    message,
  });
}
