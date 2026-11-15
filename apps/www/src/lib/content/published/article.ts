import { contentOutline } from "@repo/contents/toc";
import "@tanstack/react-start/server-only";

import { Effect, Option } from "effect";
import { readRenderedBody } from "@/lib/content/published/body";
import type {
  PublishedContentData,
  PublishedContentRouteInput,
} from "@/lib/content/published/exchange";
import { decodePublishedArticle } from "@/lib/content/published/projection";

/** Strictly narrows one verified runtime exchange to article data. */
export const decodeArticleData = Effect.fn("NakafaContent.decodeArticleData")(
  function* (data: PublishedContentData, input: PublishedContentRouteInput) {
    const projection = yield* decodePublishedArticle(data.projection, input);

    return {
      activeReleaseId: data.activeReleaseId,
      artifact: data.artifact,
      projection,
      rendererManifest: data.rendererManifest,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    };
  }
);

/** Verified article projection and signed artifact selected from active state. */
type PublishedArticleData = Effect.Success<
  ReturnType<typeof decodeArticleData>
>;

/** Renders one article already authenticated by the runtime exchange. */
export const renderArticleArtifact = Effect.fn(
  "NakafaContent.renderArticleArtifact"
)(function* (data: PublishedArticleData) {
  const body = yield* readRenderedBody(data.artifact, Option.some("article"));

  return {
    activeReleaseId: data.activeReleaseId,
    artifactHash: data.artifact.artifactHash,
    body,
    categoryTitle: data.projection.categoryTitle,
    contentId: data.projection.graph.assetId,
    headings: contentOutline(data.artifact.payload.contentTree),
    metadata: data.projection.metadata,
    official: data.projection.official,
    projection: data.projection,
    publicPath: data.projection.publicPath,
    rawMdx: data.artifact.payload.rawMdx,
    references: data.projection.references,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  };
});
