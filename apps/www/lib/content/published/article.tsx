import "server-only";

import type {
  ArticleMetadata,
  ArticleProjection,
  ArticleReference,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { normalizeArticleMetadata } from "@/lib/content/article/decode";
import { applyPublishedContentCache } from "@/lib/content/cache";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import {
  type PublishedContentData,
  type PublishedContentInput,
  type PublishedContentRouteInput,
  readCurrentPublishedContent,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import { decodePublishedArticle } from "@/lib/content/published/projection";

/** Exact public article identity pinned by an agent-facing catalog read. */
export type PublishedArticleInput = PublishedContentInput;

/** Exact public article identity resolved by the signed current runtime. */
export type CurrentPublishedArticleInput = PublishedContentRouteInput;

/** Verified article projection and signed artifact selected from active state. */
export interface PublishedArticleData
  extends Omit<PublishedContentData, "projection"> {
  readonly projection: ArticleProjection;
}

/** Rendered article data consumed by the existing article page shell. */
export interface PublishedArticleContent {
  readonly activeReleaseId: PublishedArticleData["activeReleaseId"];
  readonly artifactHash: PublishedArticleData["artifact"]["artifactHash"];
  readonly body: ReactNode;
  readonly categoryTitle: ArticleProjection["categoryTitle"];
  readonly contentId: ArticleProjection["graph"]["assetId"];
  readonly metadata: ArticleMetadata;
  readonly official: boolean;
  readonly projection: ArticleProjection;
  readonly publicPath: string;
  readonly rawMdx: string;
  readonly references: readonly ArticleReference[];
  readonly sourcePath: PublishedArticleData["sourcePath"];
  readonly sourceRevision: PublishedArticleData["sourceRevision"];
}

/** Strictly narrows one verified runtime exchange to article data. */
const decodeArticleData = Effect.fn("NakafaContent.decodeArticleData")(
  function* (data: PublishedContentData, input: PublishedContentRouteInput) {
    const projection = yield* decodePublishedArticle(data.projection, input);

    return {
      activeReleaseId: data.activeReleaseId,
      artifact: data.artifact,
      projection,
      rendererManifest: data.rendererManifest,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    } satisfies PublishedArticleData;
  }
);

/** Reads and narrows one article pinned to a selected signed release. */
export const readPublishedArticle = Effect.fn(
  "NakafaContent.readPublishedArticle"
)(function* (input: PublishedArticleInput) {
  const data = yield* readPublishedContent(input);
  return yield* decodeArticleData(data, input);
});

/** Reads and narrows one article directly from the signed current runtime. */
export const readCurrentPublishedArticle = Effect.fn(
  "NakafaContent.readCurrentPublishedArticle"
)(function* (input: CurrentPublishedArticleInput) {
  const data = yield* readCurrentPublishedContent(input);
  return yield* decodeArticleData(data, input);
});

/** Renders one article already authenticated by the runtime exchange. */
const renderArticleArtifact = Effect.fn("NakafaContent.renderArticleArtifact")(
  function* (data: PublishedArticleData) {
    const rendered = yield* evaluateVerifiedArtifact({
      artifact: data.artifact,
    });

    return {
      activeReleaseId: data.activeReleaseId,
      artifactHash: data.artifact.artifactHash,
      body: <rendered.Content />,
      categoryTitle: data.projection.categoryTitle,
      contentId: data.projection.graph.assetId,
      metadata: normalizeArticleMetadata(data.projection.metadata),
      official: data.projection.official,
      projection: data.projection,
      publicPath: data.projection.publicPath,
      rawMdx: rendered.artifact.payload.rawMdx,
      references: data.projection.references,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    } satisfies PublishedArticleContent;
  }
);

/** Caches JSX rendered from one reviewed, signed Aksara article artifact. */
export async function renderCurrentPublishedArticle(
  input: CurrentPublishedArticleInput
) {
  "use cache";

  const data = await Effect.runPromise(readCurrentPublishedArticle(input));
  const rendered = await Effect.runPromise(renderArticleArtifact(data));
  applyPublishedContentCache("article", data.artifact.artifactHash);
  return rendered;
}
