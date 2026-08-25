import "server-only";

import { MarkdownResponse } from "@repo/design-system/components/ai/markdown";
import { Effect } from "effect";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { projectTryoutReview } from "@/components/tryout/review/model";
import { TryoutReviewedChoice } from "@/components/tryout/runtime/choice-surface.client";
import {
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question-shell.client";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/** Renders one immutable terminal review outside the active runtime Module. */
export async function TryoutReview({
  content,
  runtime,
}: {
  readonly content: Promise<TryoutRuntimeContent>;
  readonly runtime: TryoutSectionRuntime;
}) {
  const resolvedContent = await content;
  const questions = await Effect.runPromise(
    projectTryoutReview({
      content: resolvedContent,
      questions: runtime.questions,
    }).pipe(
      Effect.catchTag("TryoutReviewProjectionError", () =>
        Effect.logWarning(
          "Terminal try-out review projection failed closed."
        ).pipe(Effect.as(null))
      )
    )
  );

  if (!questions) {
    return <TryoutContentRefresh />;
  }

  return (
    <section className="space-y-12">
      {questions.map((question) => (
        <TryoutReviewQuestionShell
          key={question.questionOrder}
          questionOrder={question.questionOrder}
        >
          <section className="my-6">{question.content}</section>
          <section className="my-8">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {question.choices.map((choice) => (
                <TryoutReviewedChoice
                  checked={
                    question.response?.selectedOptionId === choice.optionKey
                  }
                  id={`review-question-${question.questionOrder}-${choice.optionKey}`}
                  isCorrect={choice.isCorrect}
                  key={choice.optionKey}
                  label={
                    <MarkdownResponse
                      className="wrap-anywhere h-auto whitespace-normal"
                      id={`review-question-${question.questionOrder}-${choice.optionKey}`}
                    >
                      {choice.label}
                    </MarkdownResponse>
                  }
                />
              ))}
            </div>
          </section>
          <TryoutReviewQuestionExplanation
            questionOrder={question.questionOrder}
          >
            {question.answer}
          </TryoutReviewQuestionExplanation>
        </TryoutReviewQuestionShell>
      ))}
    </section>
  );
}
