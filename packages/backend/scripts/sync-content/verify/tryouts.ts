import path from "node:path";
import { CONTENTS_DIR } from "@repo/backend/scripts/sync-content/runtime/paths";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { locales } from "@repo/utilities/locales";

interface TryoutFileCounts {
  activeAnswerFiles: number;
  activeChoicesFiles: number;
  activeQuestionFiles: number;
  localizedQuestionFiles: number;
  localizedQuestionSets: number;
  questionSourceDirectories: number;
}

interface TryoutSectionFileCountArgs {
  answerFileSet: ReadonlySet<string>;
  choicesFileSet: ReadonlySet<string>;
  questionCount: number;
  questionFileSet: ReadonlySet<string>;
  questionSourcePath: string;
  selectedLocales: readonly string[];
}

/** Counts localized question, answer, and choices files for one source section. */
function countTryoutSectionFiles({
  answerFileSet,
  choicesFileSet,
  questionCount,
  questionFileSet,
  questionSourcePath,
  selectedLocales,
}: TryoutSectionFileCountArgs) {
  let activeAnswerFiles = 0;
  let activeChoicesFiles = 0;
  let activeQuestionFiles = 0;

  for (let number = 1; number <= questionCount; number++) {
    const questionDir = path.join(
      CONTENTS_DIR,
      questionSourcePath,
      `question-${number}`
    );

    if (choicesFileSet.has(path.join(questionDir, "choices.ts"))) {
      activeChoicesFiles += 1;
    }

    for (const locale of selectedLocales) {
      if (
        questionFileSet.has(path.join(questionDir, `question.${locale}.mdx`))
      ) {
        activeQuestionFiles += 1;
      }
      if (answerFileSet.has(path.join(questionDir, `answer.${locale}.mdx`))) {
        activeAnswerFiles += 1;
      }
    }
  }

  return {
    activeAnswerFiles,
    activeChoicesFiles,
    activeQuestionFiles,
    questionSourceDirectories: questionCount,
  };
}

/** Builds try-out file counts from active source placements. */
export function getTryoutFileCounts({
  answerFiles,
  choicesFiles,
  questionFiles,
}: {
  answerFiles: readonly string[];
  choicesFiles: readonly string[];
  questionFiles: readonly string[];
}): TryoutFileCounts {
  const answerFileSet = new Set(answerFiles);
  const choicesFileSet = new Set(choicesFiles);
  const questionFileSet = new Set(questionFiles);
  let activeAnswerFiles = 0;
  let activeChoicesFiles = 0;
  let activeQuestionFiles = 0;
  let questionSourceDirectories = 0;
  let questionSetPlacements = 0;

  for (const source of TRYOUT_SOURCES) {
    for (const track of source.tracks) {
      for (const set of track.sets) {
        for (const section of set.sections) {
          questionSetPlacements += 1;
          const sectionFileCounts = countTryoutSectionFiles({
            answerFileSet,
            choicesFileSet,
            questionCount: section.questionCount,
            questionFileSet,
            questionSourcePath: section.questionSourcePath,
            selectedLocales: locales,
          });

          activeAnswerFiles += sectionFileCounts.activeAnswerFiles;
          activeChoicesFiles += sectionFileCounts.activeChoicesFiles;
          activeQuestionFiles += sectionFileCounts.activeQuestionFiles;
          questionSourceDirectories +=
            sectionFileCounts.questionSourceDirectories;
        }
      }
    }
  }

  const localizedQuestionFiles = questionSourceDirectories * locales.length;

  return {
    activeAnswerFiles,
    activeChoicesFiles,
    activeQuestionFiles,
    localizedQuestionFiles,
    localizedQuestionSets: questionSetPlacements * locales.length,
    questionSourceDirectories,
  };
}
