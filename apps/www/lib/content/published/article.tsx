import "server-only";

import type {
  ArticleMetadata,
  ArticleProjection,
  ArticleReference,
} from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option } from "effect";
import type { ReactNode } from "react";
import {
  applyPublishedCatalogCache,
  applyPublishedContentCache,
} from "@/lib/content/cache";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import {
  type PublishedContentData,
  type PublishedContentInput,
  type PublishedContentRouteInput,
  readCurrentPublishedContent,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import { decodePublishedArticle } from "@/lib/content/published/projection";

/** Exact public article identity sent to the shared runtime seam. */
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
  readonly body: ReactNode;
  readonly categoryTitle: ArticleProjection["categoryTitle"];
  readonly contentId: ArticleProjection["graph"]["assetId"];
  readonly metadata: ArticleMetadata;
  readonly official: boolean;
  readonly publicPath: string;
  readonly rawMdx: string;
  readonly references: readonly ArticleReference[];
  readonly sourcePath: PublishedArticleData["sourcePath"];
  readonly sourceRevision: PublishedArticleData["sourceRevision"];
}

/** Strictly narrows one verified runtime exchange to article data. */
const decodeArticleData = Effect.fn("NakafaContent.decodeArticleData")(
  function* (data: PublishedContentData, input: CurrentPublishedArticleInput) {
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

/** Reads an article pinned to a release selected by another trusted read. */
export const readPublishedArticle = Effect.fn(
  "NakafaContent.readPublishedArticle"
)(function* (input: PublishedArticleInput) {
  const data = yield* readPublishedContent(input);
  return yield* decodeArticleData(data, input);
});

/** Reads an article directly from the signed current runtime. */
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
      body: <rendered.Content />,
      categoryTitle: data.projection.categoryTitle,
      contentId: data.projection.graph.assetId,
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

/** Caches one current article while preserving a truthful missing result. */
export async function getCurrentPublishedArticle(
  input: CurrentPublishedArticleInput
) {
  "use cache";

  const result = await Effect.runPromise(
    readCurrentPublishedArticle(input).pipe(
      Effect.map(Option.some),
      Effect.catchTag("ContentRuntimeMissingError", () =>
        Effect.succeed(Option.none<PublishedArticleData>())
      )
    )
  );
  if (Option.isNone(result)) {
    applyPublishedCatalogCache("article");
    return null;
  }
  applyPublishedContentCache("article", result.value.artifact.artifactHash);
  return result.value;
}

/** Caches current article JSX resolved without a redundant ownership query. */
export async function renderCurrentPublishedArticle(
  input: CurrentPublishedArticleInput
) {
  "use cache";

  const data = await getCurrentPublishedArticle(input);
  if (!data) {
    applyPublishedCatalogCache("article");
    return null;
  }
  const rendered = await Effect.runPromise(renderArticleArtifact(data));
  applyPublishedContentCache("article", data.artifact.artifactHash);
  return rendered;
}
