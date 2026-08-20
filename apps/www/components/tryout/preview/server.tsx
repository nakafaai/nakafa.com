import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { Effect, Option } from "effect";
import { io } from "next/cache";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { cache, type ReactNode } from "react";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { TryoutReviewedChoice } from "@/components/tryout/runtime/choice-surface.client";
import {
  TryoutChoicePreview,
  type TryoutPreviewChoiceItem,
} from "@/components/tryout/runtime/preview.client";
import {
  TryoutActiveQuestionShell,
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question-shell.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type QuestionPreviewContent,
  readQuestionPreview,
} from "@/lib/content/preview/question";

/** Reads a question only inside the explicitly configured development child. */
export const readTryoutQuestionPreview = cache(
  async (locale: Locale, publicPath: string) => {
    if (!hasPreviewConfig()) {
      return Option.none<QuestionPreviewContent>();
    }

    await io();
    return await Effect.runPromise(
      readQuestionPreview({
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      })
    );
  }
);

/** Projects authored choices into the shared interactive preview model. */
function previewChoices(
  content: QuestionPreviewContent
): readonly TryoutPreviewChoiceItem[] {
  return content.choices.map(({ label, value }, index) => ({
    isCorrect: value,
    label,
    optionKey: `choice-${index + 1}`,
    order: index + 1,
  }));
}

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
  const choices = previewChoices(content);
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

        <QuestionPreviewBody choices={choices} content={content}>
          <Question />
        </QuestionPreviewBody>
      </div>
    </div>
  );
}

/** Selects prompt-only or terminal-review composition without hidden fallback. */
function QuestionPreviewBody({
  children,
  choices,
  content,
}: {
  readonly children: ReactNode;
  readonly choices: readonly TryoutPreviewChoiceItem[];
  readonly content: QuestionPreviewContent;
}) {
  const questionOrder = content.target.placement.questionOrder;
  const Answer = content.Answer;

  if (Answer === null) {
    return (
      <TryoutActiveQuestionShell questionOrder={questionOrder}>
        <section className="my-6">{children}</section>
        <section className="my-8">
          <TryoutChoicePreview choices={choices} />
        </section>
      </TryoutActiveQuestionShell>
    );
  }

  return (
    <TryoutReviewQuestionShell questionOrder={questionOrder}>
      <section className="my-6">{children}</section>
      <section className="my-8">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {choices.map((choice) => (
            <TryoutReviewedChoice
              checked={choice.isCorrect}
              id={`preview-question-${questionOrder}-${choice.optionKey}`}
              isCorrect={choice.isCorrect}
              key={choice.optionKey}
              label={choice.label}
            />
          ))}
        </div>
      </section>
      <TryoutReviewQuestionExplanation questionOrder={questionOrder}>
        <Answer />
      </TryoutReviewQuestionExplanation>
    </TryoutReviewQuestionShell>
  );
}
