import { encodeJsonText } from "@repo/utilities/json";
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

/** One reviewed question: its frozen runtime fields with its signed body and answer. */
type TryoutReviewQuestion = Pick<TryoutAnswerContent, "answer"> &
  Pick<TryoutQuestionContent, "content"> &
  Pick<
    ReviewRuntimeQuestion,
    "placementId" | "questionOrder" | "response" | "responseSpec"
  >;

/** Fails closed when signed review content no longer matches frozen runtime. */
export class TryoutReviewProjectionError extends Schema.TaggedError<TryoutReviewProjectionError>()(
  "TryoutReviewProjectionError",
  {
    code: Schema.Literal("TRYOUT_REVIEW_PROJECTION"),
    message: Schema.String,
  }
) {}

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

    reviewQuestions.push({
      answer: signedAnswer.value.answer,
      content: signedQuestion.value.content,
      placementId: question.placementId,
      questionOrder: question.questionOrder,
      response: question.response,
      responseSpec: question.responseSpec,
    });
  }

  return reviewQuestions;
});

/** Builds one collision-safe key from an already trusted content identity. */
function getContentIdentity(identity: ReviewContentIdentity) {
  return encodeJsonText([
    identity.sourcePath,
    identity.contentHash,
    identity.sourceRevision,
  ]);
}

/** Creates one typed terminal-review projection failure. */
function projectionError(message: string) {
  return new TryoutReviewProjectionError({
    code: "TRYOUT_REVIEW_PROJECTION",
    message,
  });
}
