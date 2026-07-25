import "server-only";

import type {
  ArticleMetadata,
  ArticleProjection,
  ArticleReference,
} from "@nakafa/aksara-contracts/projection/article";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { applyPublishedContentCache } from "@/lib/content/cache";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import {
  type PublishedContentData,
  type PublishedContentInput,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import { decodePublishedArticle } from "@/lib/content/published/projection";
import { getRendererComponents } from "@/lib/content/renderer/components";

/** Exact public article identity sent to the shared runtime seam. */
export type PublishedArticleInput = PublishedContentInput;

/** Verified article projection and signed artifact selected from active state. */
export interface PublishedArticleData
  extends Omit<PublishedContentData, "projection"> {
  readonly projection: ArticleProjection;
}

/** Rendered article data consumed by the existing article page shell. */
export interface PublishedArticleContent {
  readonly body: ReactNode;
  readonly categoryTitle: ArticleProjection["categoryTitle"];
  readonly metadata: ArticleMetadata;
  readonly official: boolean;
  readonly publicPath: string;
  readonly rawMdx: string;
  readonly references: readonly ArticleReference[];
  readonly sourcePath: PublishedArticleData["sourcePath"];
  readonly sourceRevision: PublishedArticleData["sourceRevision"];
}

/** Reads and strictly narrows one verified runtime exchange to article data. */
export const readPublishedArticle = Effect.fn(
  "NakafaContent.readPublishedArticle"
)(function* (input: PublishedArticleInput) {
  const data = yield* readPublishedContent(input);
  const projection = yield* decodePublishedArticle(data.projection, input);

  return {
    activeReleaseId: data.activeReleaseId,
    artifact: data.artifact,
    projection,
    rendererManifest: data.rendererManifest,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  } satisfies PublishedArticleData;
});

/** Authenticates and renders one article through its physical registry. */
const renderArticleArtifact = Effect.fn("NakafaContent.renderArticleArtifact")(
  function* (data: PublishedArticleData) {
    const components = getRendererComponents(
      data.artifact.payload.rendererDomain
    );
    const rendered = yield* executeSignedArtifact({
      artifact: data.artifact,
      components,
      rendererContractVersion: data.rendererManifest.rendererContractVersion,
      rendererManifest: data.rendererManifest,
    }).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    );

    return {
      body: <rendered.Content />,
      categoryTitle: data.projection.categoryTitle,
      metadata: data.projection.metadata,
      official: data.projection.official,
      publicPath: data.projection.publicPath,
      rawMdx: rendered.artifact.payload.rawMdx,
      references: data.projection.references,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    } satisfies PublishedArticleContent;
  }
);

/** Caches verified article metadata and provenance under exact signed tags. */
export async function getPublishedArticle(input: PublishedArticleInput) {
  "use cache";

  const data = await Effect.runPromise(readPublishedArticle(input));
  applyPublishedContentCache("article", data.artifact.artifactHash);
  return data;
}

/** Caches JSX rendered from one reviewed, signed Aksara article artifact. */
export async function renderPublishedArticle(input: PublishedArticleInput) {
  "use cache";

  const data = await getPublishedArticle(input);
  return Effect.runPromise(renderArticleArtifact(data));
}
