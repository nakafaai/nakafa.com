import { Effect, Schema } from "effect";
import type { ReactNode } from "react";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import type {
  TryoutRuntimeChoice,
  TryoutRuntimeQuestion,
} from "@/components/tryout/runtime/types";

interface ReviewContentIdentity {
  readonly contentHash: string;
  readonly sourcePath: string;
  readonly sourceRevision: string;
}

interface ReviewRuntimeQuestion extends ReviewContentIdentity {
  readonly choices: readonly TryoutRuntimeChoice[];
  readonly questionOrder: number;
  readonly response: TryoutRuntimeQuestion["response"];
}

/** One immutable reviewed question ready for read-only composition. */
export interface TryoutReviewQuestion {
  readonly answer: ReactNode;
  readonly choices: readonly TryoutRuntimeChoice[];
  readonly content: ReactNode;
  readonly questionOrder: number;
  readonly response: TryoutRuntimeQuestion["response"];
}

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

  const questionContent = new Map(
    input.content.questions.map((question) => [
      getContentIdentity(question),
      question,
    ])
  );
  const answerContent = new Map(
    input.content.answers.map((answer) => [getContentIdentity(answer), answer])
  );

  if (
    questionContent.size !== input.content.questions.length ||
    answerContent.size !== input.content.answers.length
  ) {
    return yield* projectionError(
      "Terminal review content contains a duplicate frozen identity."
    );
  }

  const questionOrders = new Set<number>();
  const reviewQuestions: TryoutReviewQuestion[] = [];

  for (const question of input.questions) {
    if (questionOrders.has(question.questionOrder)) {
      return yield* projectionError(
        "Terminal review runtime contains a duplicate question order."
      );
    }
    questionOrders.add(question.questionOrder);

    const identity = getContentIdentity(question);
    const signedQuestion = questionContent.get(identity);
    const signedAnswer = answerContent.get(identity);
    if (!(signedQuestion && signedAnswer)) {
      return yield* projectionError(
        "Terminal review content lost a frozen question or answer."
      );
    }
    if (!signedAnswer.answer) {
      return yield* projectionError(
        "Terminal review content contains an empty signed answer."
      );
    }

    reviewQuestions.push({
      answer: signedAnswer.answer,
      choices: question.choices,
      content: signedQuestion.content,
      questionOrder: question.questionOrder,
      response: question.response,
    });
  }

  return reviewQuestions;
});

/** Builds one collision-safe key from an already trusted content identity. */
function getContentIdentity(identity: ReviewContentIdentity) {
  return JSON.stringify([
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
