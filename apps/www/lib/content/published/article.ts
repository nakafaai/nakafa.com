import "server-only";

import { Effect } from "effect";
import { readRenderedBody } from "@/lib/content/published/body";
import {
  type PublishedContentData,
  type PublishedContentInput,
  type PublishedContentRouteInput,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import { decodePublishedArticle } from "@/lib/content/published/projection";

/** Exact public article identity pinned by an agent-facing catalog read. */
export type PublishedArticleInput = PublishedContentInput;

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
export type PublishedArticleData = Effect.Success<
  ReturnType<typeof decodeArticleData>
>;

/** Reads and narrows one article pinned to a selected signed release. */
export const readPublishedArticle = Effect.fn(
  "NakafaContent.readPublishedArticle"
)(function* (input: PublishedArticleInput) {
  const data = yield* readPublishedContent(input);
  return yield* decodeArticleData(data, input);
});

/** Renders one article already authenticated by the runtime exchange. */
export const renderArticleArtifact = Effect.fn(
  "NakafaContent.renderArticleArtifact"
)(function* (data: PublishedArticleData) {
  const body = yield* readRenderedBody(data.artifact);

  return {
    activeReleaseId: data.activeReleaseId,
    artifactHash: data.artifact.artifactHash,
    body,
    categoryTitle: data.projection.categoryTitle,
    contentId: data.projection.graph.assetId,
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

/** Rendered article data consumed by the existing article page shell. */
export type PublishedArticleContent = Effect.Success<
  ReturnType<typeof renderArticleArtifact>
>;
