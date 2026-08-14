import { ArticlePreviewDocumentSchema } from "@nakafa/aksara-contracts/preview/document";
import {
  LOCAL_PREVIEW_FORMAT,
  PreviewPendingSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import { ArticleRouteSchema } from "@nakafa/aksara-contracts/projection/article";
import { Schema } from "effect";
import {
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";
import { previewRepositories } from "@/test/content-preview";

const articleRoute = Schema.decodeUnknownSync(ArticleRouteSchema)({
  articleSlug: testArticleProjection.articleSlug,
  appLocale: testArticleProjection.appLocale,
  articleRouteSlug: testArticleProjection.articleRouteSlug,
  artifactLocale: testArticleProjection.artifactLocale,
  category: testArticleProjection.category,
  categoryRouteSlug: testArticleProjection.categoryRouteSlug,
  contentKey: testArticleProjection.contentKey,
  graph: testArticleProjection.graph,
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
