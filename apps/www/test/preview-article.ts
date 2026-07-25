import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import { ArticlePreviewDocumentSchema } from "@nakafa/aksara-contracts/preview/document";
import {
  LOCAL_PREVIEW_FORMAT,
  PreviewFailedSchema,
  PreviewPendingSchema,
  PreviewReadySchema,
} from "@nakafa/aksara-contracts/preview/spec";
import { ArticleRouteSchema } from "@nakafa/aksara-contracts/projection/article";
import { Schema } from "effect";
import {
  testArticleArtifact,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";
import { previewRepositories } from "@/test/content-preview";

const articleRoute = Schema.decodeUnknownSync(ArticleRouteSchema)({
  articleSlug: testArticleProjection.articleSlug,
  category: testArticleProjection.category,
  contentKey: testArticleProjection.contentKey,
  graph: testArticleProjection.graph,
  locale: testArticleProjection.locale,
  publicPath: testArticleProjection.publicPath,
});

/** Exact real article selected by local preview tests. */
export const articlePreviewDocument = Schema.decodeUnknownSync(
  ArticlePreviewDocumentSchema
)({
  delivery: "public",
  family: "article",
  rendererDomain: "politics",
  route: articleRoute,
  sourcePath: testArticleSourcePath,
});

/** Pending state for one real article that a material route must ignore. */
export const articlePendingManifest = Schema.decodeUnknownSync(
  PreviewPendingSchema
)({
  document: articlePreviewDocument,
  format: LOCAL_PREVIEW_FORMAT,
  repositories: previewRepositories,
  revision: 1,
  status: "pending",
});

/** Creates one ready state for the real article and current renderer. */
export function makeArticleReadyManifest(rendererManifestHash: Sha256Hash) {
  return Schema.decodeUnknownSync(PreviewReadySchema)({
    artifacts: [
      {
        artifactHash: testArticleArtifact.artifactHash,
        artifactPath: `/v1/artifacts/${encodeURIComponent(testArticleArtifact.artifactHash)}`,
        projection: testArticleProjection,
      },
    ],
    document: articlePreviewDocument,
    format: LOCAL_PREVIEW_FORMAT,
    rendererManifestHash,
    repositories: previewRepositories,
    revision: 1,
    status: "ready",
  });
}

/** Creates one sanitized article compiler failure without stale content. */
export function makeArticleFailedManifest() {
  return Schema.decodeUnknownSync(PreviewFailedSchema)({
    document: articlePreviewDocument,
    failure: { code: "MDX_PARSE", message: "Compilation failed." },
    format: LOCAL_PREVIEW_FORMAT,
    repositories: previewRepositories,
    revision: 1,
    status: "failed",
  });
}
