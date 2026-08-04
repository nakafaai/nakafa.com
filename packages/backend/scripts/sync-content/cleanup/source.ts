import path from "node:path";
import {
  parseArticlePath,
  parseMaterialLessonPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { getLocalizedSourceKey } from "@repo/backend/scripts/sync-content/contract/key";
import { parseLocale } from "@repo/backend/scripts/sync-content/contract/schemas";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime/files";
import { listLessonRows } from "@repo/contents/_types/material/registry";
import {
  lookupNamespaceSegment,
  makePath,
} from "@repo/contents/_types/route/path";
import type { TryoutExamSource } from "@repo/contents/_types/tryout/schema";
import { type Locale, locales } from "@repo/utilities/locales";
import { Effect } from "effect";

const QUESTION_FILE_PREFIX = "question.";
const QUESTION_FILE_SUFFIX = ".mdx";
const TRYOUT_QUESTION_ROOT = "/question-bank/tryout/";

/** Collects article and curriculum slugs that should exist in Convex. */
export const collectFilesystemArticleCurriculumSlugs = Effect.fn(
  "sync.collectFilesystemArticleCurriculumSlugs"
)(function* () {
  const [articleFiles, lessonFiles] = yield* Effect.all([
    globFiles("articles/**/*.mdx"),
    globFiles("material/lesson/**/*.mdx"),
  ]);

  const articleSlugs: string[] = [];
  for (const file of articleFiles) {
    const pathInfo = yield* parseArticlePath(file);
    articleSlugs.push(pathInfo.slug);
  }

  const curriculumLessonSlugs: string[] = [];
  for (const file of lessonFiles) {
    const pathInfo = yield* parseMaterialLessonPath(file);
    curriculumLessonSlugs.push(pathInfo.slug);
  }

  return {
    articleSlugs,
    curriculumLessonSlugs,
    curriculumTopicSlugs: listLessonRows().map((topic) => topic.slug),
  };
});

/** Collects filesystem tryout identities only while the filesystem owns them. */
export const collectFilesystemTryoutSlugs = Effect.fn(
  "sync.collectFilesystemTryoutSlugs"
)(function* () {
  const [{ TRYOUT_SOURCES: tryoutSources }, questionFiles] = yield* Effect.all([
    Effect.promise(() => import("@repo/contents/_types/tryout/source")),
    globFiles("question-bank/tryout/**/question.*.mdx"),
  ]);
  const tryoutPaths = yield* collectTryoutPaths(tryoutSources);
  const questionSetSourcePaths =
    listActiveTryoutQuestionSetPaths(tryoutSources);
  const activeQuestionSourcePaths = new Set(
    listActiveTryoutQuestionPaths(tryoutSources)
  );
  const questionSourcePaths = new Set<string>();
  const questionSourceKeys = new Set<string>();

  for (const file of questionFiles) {
    const sourcePath = readQuestionSourcePath(file);

    if (!activeQuestionSourcePaths.has(sourcePath)) {
      continue;
    }

    const locale = yield* readQuestionLocale(file);

    questionSourcePaths.add(sourcePath);
    questionSourceKeys.add(getQuestionSourceKey(locale, sourcePath));
  }

  return {
    questionSetSourcePaths,
    questionSourceKeys: [...questionSourceKeys],
    questionSourcePaths: [...questionSourcePaths],
    ...tryoutPaths,
  };
});

/** Collects every source-owned try-out catalog identity, including unpublished sets. */
const collectTryoutPaths = Effect.fn("sync.collectTryoutPaths")(function* (
  tryoutSources: readonly TryoutExamSource[]
) {
  const tryoutCountryKeys = new Set<string>();
  const tryoutExamKeys = new Set<string>();
  const tryoutTrackKeys = new Set<string>();
  const tryoutSetKeys = new Set<string>();
  const tryoutSectionKeys = new Set<string>();

  for (const source of tryoutSources) {
    for (const locale of locales) {
      const tryoutPath = yield* makePath([
        yield* lookupNamespaceSegment("tryout", locale),
      ]);
      const countryPath = yield* makePath([
        tryoutPath,
        source.countryRouteSlugs[locale],
      ]);
      const examPath = yield* makePath([
        countryPath,
        source.examRouteSlugs[locale],
      ]);

      tryoutCountryKeys.add(getLocalizedSourceKey(locale, countryPath));
      tryoutExamKeys.add(getLocalizedSourceKey(locale, examPath));

      for (const track of source.tracks) {
        const trackPath = yield* makePath([examPath, track.routeSlugs[locale]]);
        tryoutTrackKeys.add(getLocalizedSourceKey(locale, trackPath));

        for (const set of track.sets) {
          const setPath = yield* makePath([trackPath, set.routeSlugs[locale]]);
          tryoutSetKeys.add(getLocalizedSourceKey(locale, setPath));

          for (const section of set.sections) {
            let sourcePath = section.questionSourcePath;

            if (section.visibility === "visible") {
              sourcePath = yield* makePath([
                setPath,
                section.routeSlugs[locale],
              ]);
            }

            tryoutSectionKeys.add(getLocalizedSourceKey(locale, sourcePath));
          }
        }
      }
    }
  }

  return {
    tryoutCountryKeys: [...tryoutCountryKeys],
    tryoutExamKeys: [...tryoutExamKeys],
    tryoutSectionKeys: [...tryoutSectionKeys],
    tryoutSetKeys: [...tryoutSetKeys],
    tryoutTrackKeys: [...tryoutTrackKeys],
  };
});

/** Reads the question source path from an absolute MDX file path. */
function readQuestionSourcePath(file: string) {
  const normalized = file.replaceAll("\\", "/");
  const markerIndex = normalized.indexOf(TRYOUT_QUESTION_ROOT);

  if (markerIndex < 0) {
    return normalized;
  }

  const relativeFile = normalized.slice(markerIndex + 1);
  const basename = readBasename(normalized);

  return relativeFile.slice(0, -`/${basename}`.length);
}

/** Reads the locale segment from one try-out question MDX filename. */
const readQuestionLocale = Effect.fn("sync.readQuestionLocale")(function* (
  file: string
) {
  const basename = path.basename(file);
  const start = QUESTION_FILE_PREFIX.length;
  const end = basename.length - QUESTION_FILE_SUFFIX.length;
  const locale = basename.slice(start, end);

  return yield* parseLocale(locale, basename);
});

/** Builds the locale-qualified source key used for stale question cleanup. */
function getQuestionSourceKey(locale: Locale, sourcePath: string) {
  return getLocalizedSourceKey(locale, sourcePath);
}

/** Lists source-owned try-out question-set folders that should exist in Convex. */
function listActiveTryoutQuestionSetPaths(
  tryoutSources: readonly TryoutExamSource[]
) {
  return tryoutSources.flatMap((source) =>
    source.tracks.flatMap((track) =>
      track.sets.flatMap((set) =>
        set.sections.map((section) => section.questionSourcePath)
      )
    )
  );
}

/** Lists exact source-owned try-out question files that should exist in Convex. */
function listActiveTryoutQuestionPaths(
  tryoutSources: readonly TryoutExamSource[]
) {
  return tryoutSources.flatMap((source) =>
    source.tracks.flatMap((track) =>
      track.sets.flatMap((set) =>
        set.sections.flatMap((section) =>
          Array.from(
            { length: section.questionCount },
            (_, index) => `${section.questionSourcePath}/question-${index + 1}`
          )
        )
      )
    )
  );
}

/** Reads the final path segment from a normalized POSIX-style path. */
function readBasename(file: string) {
  return file.slice(file.lastIndexOf("/") + 1);
}
