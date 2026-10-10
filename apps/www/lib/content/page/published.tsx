import "server-only";

import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { PublicPageProjectionSchema } from "@nakafa/aksara-contracts/projection/page";
import { PublicContentRuntimeFoundSchema } from "@nakafa/aksara-contracts/runtime/spec";
import { Effect, Option, Schema } from "effect";
import { applyContentCache } from "@/lib/content/cache";
import { readRenderedBody } from "@/lib/content/published/body";
import {
  type PublishedContentData,
  type PublishedContentRouteInput,
  readCurrentPublishedContent,
} from "@/lib/content/published/exchange";
import { decodePublishedPage } from "@/lib/content/published/projection";

/** Current public Page identity resolved from signed runtime state. */
export type CurrentPublishedPageInput = PublishedContentRouteInput;

const PublishedPageDataSchema = Schema.Struct({
  activeReleaseId: PublicContentRuntimeFoundSchema.fields.activeReleaseId,
  artifact: PublicContentRuntimeFoundSchema.fields.artifact,
  projection: PublicPageProjectionSchema,
  rendererManifest: PublicContentRuntimeFoundSchema.fields.rendererManifest,
  sourcePath: PublicContentRuntimeFoundSchema.fields.sourcePath,
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});

/** Narrows one authenticated runtime exchange to a signed Page. */
const decodePageData = Effect.fn("NakafaContent.decodePageData")(function* (
  data: PublishedContentData,
  input: CurrentPublishedPageInput
) {
  const projection = yield* decodePublishedPage(data.projection, input);
  return {
    activeReleaseId: data.activeReleaseId,
    artifact: data.artifact,
    projection,
    rendererManifest: data.rendererManifest,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  } satisfies PublishedPageData;
});

/** Verified signed runtime data narrowed to the Page projection contract. */
type PublishedPageData = typeof PublishedPageDataSchema.Type;

/** Reads a Page directly from the signed current runtime. */
const readCurrentPublishedPage = Effect.fn(
  "NakafaContent.readCurrentPublishedPage"
)(function* (input: CurrentPublishedPageInput) {
  const data = yield* readCurrentPublishedContent(input);
  return yield* decodePageData(data, input);
});

/** Evaluates one Page artifact already authenticated by its runtime exchange. */
const renderPageArtifact = Effect.fn("NakafaContent.renderPageArtifact")(
  function* (data: PublishedPageData) {
    const body = yield* readRenderedBody(data.artifact);
    return {
      artifactHash: data.artifact.artifactHash,
      body,
      projection: data.projection,
      rawMdx: data.artifact.payload.rawMdx,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    };
  }
);

/** Caches one current Page while preserving a truthful signed absence. */
export async function getCurrentPublishedPage(
  input: CurrentPublishedPageInput
) {
  "use cache";

  const result = await Effect.runPromise(
    readCurrentPublishedPage(input).pipe(
      Effect.asSome,
      Effect.catchTag("ContentRuntimeMissingError", () => Effect.succeedNone)
    )
  );
  if (Option.isNone(result)) {
    applyContentCache("page");
    return null;
  }
  applyContentCache("page");
  return result.value;
}

/** Caches current Page JSX resolved without a second runtime lookup. */
export async function renderCurrentPublishedPage(
  input: CurrentPublishedPageInput
) {
  "use cache";

  const data = await getCurrentPublishedPage(input);
  if (!data) {
    applyContentCache("page");
    return null;
  }
  const rendered = await Effect.runPromise(renderPageArtifact(data));
  applyContentCache("page");
  return rendered;
}
