import "server-only";

import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import {
  TryoutActiveQuestionShell,
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question-shell.client";
import { renderTryoutResponseLabels } from "@/components/tryout/runtime/response/labels";
import { TryoutResponsePreview } from "@/components/tryout/runtime/response/preview.client";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";
import {
  TryoutPageBody,
  TryoutPageHeader,
} from "@/components/tryout/shell/header";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import type { QuestionPreviewContent } from "@/lib/content/preview/question";

/** Renders one authenticated prompt or full answer on its real public route. */
export async function TryoutQuestionPreview({
  content,
}: {
  readonly content: QuestionPreviewContent;
}) {
  const articleNavigation = await getShellArticleNavigation(content.appLocale);
  const { exam, section, set, track } = content.target;
  const Question = content.Question;
  return (
    <AppShell articleNavigation={articleNavigation}>
      <TryoutPageHeader
        action={null}
        items={[
          { href: getTryoutPublicPathHref(exam.publicPath), label: exam.title },
          {
            href: getTryoutPublicPathHref(track.publicPath),
            label: track.title,
          },
          ...(section.publicPath
            ? [
                {
                  href: getTryoutPublicPathHref(set.publicPath),
                  label: set.title,
                },
              ]
            : []),
        ]}
        title={section.title}
      />
      <TryoutPageBody>
        <QuestionPreviewBody content={content}>
          <Question />
        </QuestionPreviewBody>
      </TryoutPageBody>
    </AppShell>
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
  const Answer = content.Answer;

  if (Answer === null) {
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
        <Answer />
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
      assignments: response.statements.map(
        ({ correctCategoryKey, statementKey }) => ({
          categoryKey: correctCategoryKey,
          statementKey,
        })
      ),
      kind: "category",
    };
  }
  const optionKeys = response.options.flatMap(({ isCorrect, optionKey }) =>
    isCorrect ? [optionKey] : []
  );
  if (response.kind === "multiple-choice") {
    return { kind: "multiple-choice", optionKeys };
  }
  const optionKey = optionKeys[0];
  return optionKey ? { kind: "single-choice", optionKey } : null;
}
