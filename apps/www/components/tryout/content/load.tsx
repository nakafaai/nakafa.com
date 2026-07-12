import type { Locale } from "next-intl";
import { createElement, type ReactNode } from "react";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { importContentModuleOrNull } from "@/lib/content/module";

export interface TryoutQuestionContent {
  content: ReactNode;
  contentHash: string;
  sourcePath: string;
  sourceRevision: string;
}

export interface TryoutAnswerContent {
  answer: ReactNode;
  contentHash: string;
  sourcePath: string;
  sourceRevision: string;
}

interface TryoutQuestionSource {
  contentHash: string;
  questionOrder: number;
  sourcePath: string;
  sourceRevision: string;
}

/**
 * Loads compiled try-out question MDX modules from the content source tree.
 *
 * Convex owns realtime question identity, ordering, choices, and attempt state;
 * the content package owns rich MDX rendering for diagrams, math, and authored
 * components.
 */
export async function loadTryoutQuestionContent({
  locale,
  questions,
}: {
  locale: Locale;
  questions: readonly TryoutQuestionSource[];
}) {
  "use cache";
  applyContentRuntimeCache();

  const entries = await Promise.all(
    questions.map(async (question) => {
      const questionModule = await importContentModuleOrNull({
        context: {
          question_number: question.questionOrder,
          source_path: question.sourcePath,
        },
        filePath: `${question.sourcePath}/question`,
        locale,
        source: "tryout-question-module",
      });

      if (!questionModule?.default) {
        return null;
      }

      return {
        content: createElement(questionModule.default),
        contentHash: question.contentHash,
        sourcePath: question.sourcePath,
        sourceRevision: question.sourceRevision,
      };
    })
  );

  const content: TryoutQuestionContent[] = [];

  for (const entry of entries) {
    if (!entry) {
      return null;
    }

    content.push(entry);
  }

  return content;
}

/** Loads answer MDX only after the route authorizes terminal review. */
export async function loadTryoutAnswerContent({
  locale,
  questions,
}: {
  locale: Locale;
  questions: readonly TryoutQuestionSource[];
}) {
  "use cache";
  applyContentRuntimeCache();

  const entries = await Promise.all(
    questions.map(async (question) => {
      const answerModule = await importContentModuleOrNull({
        context: {
          question_number: question.questionOrder,
          source_path: question.sourcePath,
        },
        filePath: `${question.sourcePath}/answer`,
        locale,
        source: "tryout-answer-module",
      });

      if (!answerModule?.default) {
        return null;
      }

      return {
        answer: createElement(answerModule.default),
        contentHash: question.contentHash,
        sourcePath: question.sourcePath,
        sourceRevision: question.sourceRevision,
      };
    })
  );
  const content: TryoutAnswerContent[] = [];

  for (const entry of entries) {
    if (!entry) {
      return null;
    }

    content.push(entry);
  }

  return content;
}
