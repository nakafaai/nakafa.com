import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { documentSections } from "@repo/backend/confect/contents/sections/draft";
import { SECTIONS_PER_DOCUMENT } from "@repo/backend/confect/contents/sections/limits";
import type {
  lessonValidator,
  SectionDocument,
} from "@repo/backend/confect/contents/sections/schema";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Array as Arr, Effect } from "effect";

/**
 * Splits one lesson into the sections of a document, from the same agent
 * markdown that a reader of the lesson gets, so that the anchor of a section
 * opens it when it is read. A lesson whose source cannot be projected fails,
 * as it fails every reader of that lesson, so that a build stops with the
 * lesson named and the index never lacks a lesson without saying so. So does a
 * lesson with more sections than a document may have.
 */
export const lessonDocument = Effect.fn("contents.sections.lessonDocument")(
  function* (lesson: typeof lessonValidator.Type) {
    const { rawMdx, title, version, ...source } = lesson;
    const body = yield* projectMdxForAgentMarkdown(rawMdx).pipe(
      Effect.catchTag("MdxAgentProjectionError", (error) =>
        releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Lesson ${source.contentKey}/${source.appLocale} cannot be split into sections: ${error.message}`
        )
      )
    );
    const sections = documentSections(
      source,
      title,
      Arr.join([`# ${title}`, "", body.trim()], "\n")
    );
    if (sections.length > SECTIONS_PER_DOCUMENT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Lesson ${source.contentKey}/${source.appLocale} has more than ${SECTIONS_PER_DOCUMENT} sections.`
      );
    }
    return {
      appLocale: source.appLocale,
      contentKey: source.contentKey,
      section: source.section,
      sections,
      version,
    } satisfies SectionDocument;
  }
);
