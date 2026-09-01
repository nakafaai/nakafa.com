import "server-only";

import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
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
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";
import type { QuestionPreviewContent } from "@/lib/content/preview/question";

/** Renders one authenticated prompt or full answer on its real public route. */
export async function TryoutQuestionPreview({
  content,
}: {
  readonly content: QuestionPreviewContent;
}) {
  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale: content.appLocale, namespace: "Common" }),
    getTranslations({ locale: content.appLocale, namespace: "Tryouts" }),
  ]);
  const { exam, section, set, track } = content.target;
  const Question = content.Question;
  const parentPublicPath =
    section.publicPath === undefined ? track.publicPath : set.publicPath;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          value={{
            description: section.description,
            icon: getMaterialIcon(section.sectionKey),
            link: {
              href: getTryoutPublicPathHref(parentPublicPath),
              label: tCommon("back"),
            },
            meta: <TryoutMeta items={[exam.title, track.title, set.title]} />,
            status: tTryouts("part-head-ready"),
            title: section.title,
          }}
        />

        <QuestionPreviewBody content={content}>
          <Question />
        </QuestionPreviewBody>
      </div>
    </div>
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
