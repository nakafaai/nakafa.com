import {
  parseArticlePath,
  parseMaterialLessonPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime/files";
import { listLessonRows } from "@repo/contents/_types/material/registry";
import { Effect } from "effect";

/** Collects Nakafa-owned article and curriculum slugs that should exist in Convex. */
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
