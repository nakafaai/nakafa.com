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

const articleRoute = Schema.decodeSync(ArticleRouteSchema)({
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

const germanArticleRoute = Schema.decodeSync(ArticleRouteSchema)({
  ...articleRoute,
  appLocale: "de",
  articleRouteSlug: "politische-dynastien-und-asiatische-werte",
  artifactLocale: "de",
  categoryRouteSlug: "politik",
  graph: {
    ...articleRoute.graph,
    assetId: articleRoute.graph.assetId.replace("asset:en:", "asset:de:"),
  },
  publicPath: "articles/politik/politische-dynastien-und-asiatische-werte",
});

/** Exact real article selected by local preview tests. */
export const articlePreviewDocument = Schema.decodeSync(
  ArticlePreviewDocumentSchema
)({
  delivery: "public",
  family: "article",
  rendererDomain: "politics",
  route: articleRoute,
  sourcePath: testArticleSourcePath,
});

/** Exact real German article route used by candidate-locale preview tests. */
const germanArticlePreviewDocument = Schema.decodeSync(
  ArticlePreviewDocumentSchema
)({
  ...articlePreviewDocument,
  route: germanArticleRoute,
  sourcePath:
    "packages/corpus/articles/politics/dynastic-politics/asian-values/de.mdx",
});

/** Pending state for one real article that a material route must ignore. */
export const articlePendingManifest = Schema.decodeSync(PreviewPendingSchema)({
  document: articlePreviewDocument,
  format: LOCAL_PREVIEW_FORMAT,
  repositories: previewRepositories,
  revision: 1,
  status: "pending",
});

/** Pending state for the real localized German article preview route. */
export const germanArticlePendingManifest = Schema.decodeSync(
  PreviewPendingSchema
)({
  document: germanArticlePreviewDocument,
  format: LOCAL_PREVIEW_FORMAT,
  repositories: previewRepositories,
  revision: 1,
  status: "pending",
});
