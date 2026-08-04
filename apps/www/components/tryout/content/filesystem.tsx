import type { Locale } from "next-intl";
import { createElement } from "react";
import type {
  TryoutAnswerContent,
  TryoutFilesystemSource,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { importContentModuleOrNull } from "@/lib/content/module";

/** Loads question MDX for one attempt created before signed ownership. */
export async function loadFilesystemQuestions({
  locale,
  questions,
}: {
  readonly locale: Locale;
  readonly questions: readonly TryoutFilesystemSource[];
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

      const content: TryoutQuestionContent = {
        content: createElement(questionModule.default),
        contentHash: question.contentHash,
        sourcePath: question.sourcePath,
        sourceRevision: question.sourceRevision,
      };
      return content;
    })
  );

  return collectContent(entries);
}

/** Loads answer MDX for one authorized pre-Aksara terminal attempt. */
export async function loadFilesystemAnswers({
  locale,
  questions,
}: {
  readonly locale: Locale;
  readonly questions: readonly TryoutFilesystemSource[];
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

      const content: TryoutAnswerContent = {
        answer: createElement(answerModule.default),
        contentHash: question.contentHash,
        sourcePath: question.sourcePath,
        sourceRevision: question.sourceRevision,
      };
      return content;
    })
  );

  return collectContent(entries);
}

/** Rejects a partially available content collection. */
function collectContent<A>(entries: readonly (A | null)[]) {
  const content: A[] = [];

  for (const entry of entries) {
    if (!entry) {
      return null;
    }
    content.push(entry);
  }

  return content;
}
