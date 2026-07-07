import type { Locale } from "next-intl";
import type { ReactNode } from "react";
import { importContentModuleOrNull } from "@/lib/content/module";

export interface TryoutQuestionContent {
  content: ReactNode;
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
  const entries = await Promise.all(
    questions.map(async (question) => {
      const module = await importContentModuleOrNull({
        context: {
          question_number: question.questionOrder,
          source_path: question.sourcePath,
        },
        filePath: `${question.sourcePath}/question`,
        locale,
        source: "tryout-question-module",
      });

      if (!module?.default) {
        return null;
      }

      const Question = module.default;

      return {
        content: <Question />,
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
