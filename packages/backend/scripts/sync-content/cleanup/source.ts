import path from "node:path";
import {
  parseArticlePath,
  parseMaterialLessonPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { getLocalizedSourceKey } from "@repo/backend/scripts/sync-content/contract/key";
import { parseLocale } from "@repo/backend/scripts/sync-content/contract/schemas";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime/files";
import { listLessonRows } from "@repo/contents/_types/material/registry";
import { listPublicTryoutRoutes } from "@repo/contents/_types/route/tryout";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { type Locale, locales } from "@repo/utilities/locales";
import { Effect } from "effect";

const QUESTION_FILE_PREFIX = "question.";
const QUESTION_FILE_SUFFIX = ".mdx";
const TRYOUT_QUESTION_ROOT = "/question-bank/tryout/";

/** Collects source slugs from the content files that should exist in Convex. */
export const collectFilesystemSlugs = Effect.fn("sync.collectFilesystemSlugs")(
  function* () {
    const [articleFiles, lessonFiles, questionFiles] = yield* Effect.all([
      globFiles("articles/**/*.mdx"),
      globFiles("material/lesson/**/*.mdx"),
      globFiles("question-bank/tryout/**/question.*.mdx"),
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

    const curriculumTopicSlugs = listLessonRows().map((topic) => topic.slug);
    const tryoutPaths = yield* collectTryoutPaths();
    const questionSetSourcePaths = listActiveTryoutQuestionSetPaths();
    const activeQuestionSourcePaths = new Set(listActiveTryoutQuestionPaths());
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
      articleSlugs,
      curriculumLessonSlugs,
      curriculumTopicSlugs,
      questionSetSourcePaths,
      questionSourceKeys: [...questionSourceKeys],
      questionSourcePaths: [...questionSourcePaths],
      ...tryoutPaths,
    };
  }
);

/** Collects source-owned public try-out paths grouped by catalog table. */
const collectTryoutPaths = Effect.fn("sync.collectTryoutPaths")(function* () {
  const routes = yield* listPublicTryoutRoutes();

  return {
    tryoutCountryKeys: routes
      .filter((route) => route.kind === "tryout-country")
      .map((route) => getLocalizedSourceKey(route.locale, route.publicPath)),
    tryoutExamKeys: routes
      .filter((route) => route.kind === "tryout-exam")
      .map((route) => getLocalizedSourceKey(route.locale, route.publicPath)),
    tryoutTrackKeys: routes
      .filter((route) => route.kind === "tryout-track")
      .map((route) => getLocalizedSourceKey(route.locale, route.publicPath)),
    tryoutSectionKeys: [
      ...routes
        .filter((route) => route.kind === "tryout-section")
        .map((route) => getLocalizedSourceKey(route.locale, route.publicPath)),
      ...listActiveInternalTryoutSectionKeys(),
    ],
    tryoutSetKeys: routes
      .filter((route) => route.kind === "tryout-set")
      .map((route) => getLocalizedSourceKey(route.locale, route.publicPath)),
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
function listActiveTryoutQuestionSetPaths() {
  return TRYOUT_SOURCES.flatMap((source) =>
    source.tracks.flatMap((track) =>
      track.sets.flatMap((set) =>
        set.sections.map((section) => section.questionSourcePath)
      )
    )
  );
}

/** Lists exact source-owned try-out question files that should exist in Convex. */
function listActiveTryoutQuestionPaths() {
  return TRYOUT_SOURCES.flatMap((source) =>
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

/** Lists internal try-out sections by source path because they have no public route. */
function listActiveInternalTryoutSectionKeys() {
  return TRYOUT_SOURCES.flatMap((source) =>
    source.tracks.flatMap((track) =>
      track.sets.flatMap((set) =>
        set.sections.flatMap((section) =>
          section.visibility === "internal-entry"
            ? locales.map((locale) =>
                getLocalizedSourceKey(locale, section.questionSourcePath)
              )
            : []
        )
      )
    )
  );
}

/** Reads the final path segment from a normalized POSIX-style path. */
function readBasename(file: string) {
  return file.slice(file.lastIndexOf("/") + 1);
}
