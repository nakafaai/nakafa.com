import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import type { ContentReferenceInput } from "@repo/backend/confect/contentRelease/reference/spec";
import type { ContentSearchDocument } from "@repo/backend/confect/contents/helpers/search/groups";
import { readArticleReference } from "@repo/backend/content/article/reference";
import { readMaterialReference } from "@repo/backend/content/material/reference";
import { readQuranReference } from "@repo/backend/content/quran/identity";
import { readTryoutReference } from "@repo/backend/content/tryout/reference";
import { Effect } from "effect";
/** Resolves one current semantic identity across every active signed family. */
export const readContentReference = Effect.fn(
  "contentRelease.readContentReference"
)(function* (input: ContentReferenceInput) {
  const activeInput = yield* resolveReferenceInput(input);
  if (!activeInput) {
    return null;
  }
  let match: ContentSearchDocument | null;
  if (activeInput.family === "article") {
    match = yield* readArticleReference(activeInput);
  } else if (activeInput.family === "material") {
    match = yield* readMaterialReference(activeInput);
  } else if (activeInput.family === "quran") {
    match = yield* readQuranReference(activeInput);
  } else {
    match = yield* readTryoutReference(activeInput);
  }
  if (!match) {
    return null;
  }
  return {
    alignmentId: match.alignmentId,
    assetId: match.assetId,
    conceptId: match.conceptId,
    content_id: match.content_id,
    description: match.description,
    learningObjectId: match.learningObjectId,
    lensId: match.lensId,
    locale: match.locale,
    ...(match.markdown_url === undefined
      ? {}
      : {
          markdown_url: match.markdown_url,
        }),
    route: match.route,
    section: match.section,
    title: match.title,
    url: match.url,
  };
});
