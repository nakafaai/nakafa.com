import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import {
  TryoutActiveQuestionShell,
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell";
import { TryoutResponsePreview } from "@/components/tryout/runtime/response/echo";
import { renderTryoutResponseLabels } from "@/components/tryout/runtime/response/labels";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";
import {
  TryoutPage,
  TryoutPageBody,
  TryoutPageHeader,
} from "@/components/tryout/shell/header";
import type { QuestionPreviewContent } from "@/lib/content/preview/question";

/** Renders one authenticated prompt or full answer on its real public route. */
export function TryoutQuestionPreview({
  content,
}: {
  readonly content: QuestionPreviewContent;
}) {
  const { exam, section, set, track } = content.target;
  const question = content.Question;
  return (
    <TryoutPage>
      <TryoutPageHeader
        items={[
          {
            label: exam.title,
            target: Option.getOrUndefined(
              getTryoutCrumbTarget(exam.publicPath)
            ),
          },
          {
            label: track.title,
            target: Option.getOrUndefined(
              getTryoutCrumbTarget(track.publicPath)
            ),
          },
          ...(section.publicPath
            ? [
                {
                  label: set.title,
                  target: Option.getOrUndefined(
                    getTryoutCrumbTarget(set.publicPath)
                  ),
                },
              ]
            : []),
        ]}
        title={section.title}
      />
      <TryoutPageBody>
        <QuestionPreviewBody content={content}>{question}</QuestionPreviewBody>
      </TryoutPageBody>
    </TryoutPage>
  );
}

/** Selects prompt-only or terminal-review composition without hidden fallback. */
function QuestionPreviewBody({
  children,
  content,
}: {
  readonly children: ReactNode;
  readonly content: QuestionPreviewContent;
}) {
  const questionOrder = content.target.placement.questionOrder;
  const answer = content.Answer;

  if (answer === null) {
    const responseId = `preview-question-${questionOrder}`;
    return (
      <TryoutActiveQuestionShell questionOrder={questionOrder}>
        <section className="my-6">{children}</section>
        <section className="my-8">
          <TryoutResponsePreview
            id={responseId}
            labels={renderTryoutResponseLabels(responseId, content.response)}
            responseSpec={content.response}
          />
        </section>
      </TryoutActiveQuestionShell>
    );
  }

  return (
    <TryoutReviewQuestionShell questionOrder={questionOrder}>
      <section className="my-6">{children}</section>
      <section className="my-8">
        <TryoutReviewedResponse
          questionOrder={questionOrder}
          responseSpec={content.response}
          selection={correctSelection(content.response)}
        />
      </section>
      <TryoutReviewQuestionExplanation questionOrder={questionOrder}>
        {answer}
      </TryoutReviewQuestionExplanation>
    </TryoutReviewQuestionShell>
  );
}

/** Selects the authored answer key for terminal preview styling. */
function correctSelection(
  response: QuestionPreviewContent["response"]
): TryoutResponseSelection | null {
  if (response.kind === "category") {
    return {
      assignments: Arr.map(
        response.statements,
        ({ correctCategoryKey, statementKey }) => ({
          categoryKey: correctCategoryKey,
          statementKey,
        })
      ),
      kind: "category",
    };
  }
  if (response.kind === "short-answer" || response.kind === "rubric") {
    return null;
  }
  const optionKeys = Arr.flatMap(
    response.options,
    ({ isCorrect, optionKey }) => (isCorrect ? [optionKey] : [])
  );
  if (response.kind === "multiple-choice") {
    return { kind: "multiple-choice", optionKeys };
  }
  const optionKey = optionKeys[0];
  return optionKey ? { kind: "single-choice", optionKey } : null;
}
