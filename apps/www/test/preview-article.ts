import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import { ArticlePreviewDocumentSchema } from "@nakafa/aksara-contracts/preview/document";
import {
  LOCAL_PREVIEW_FORMAT,
  PreviewPendingSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import { ArticleRouteSchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Schema } from "effect";
import { previewRepositories } from "@/test/content-preview";

const articleRoute = Schema.decodeUnknownSync(ArticleRouteSchema)({
  articleSlug: "cabinet-analysis",
  category: "politics",
  contentKey: "articles/politics/cabinet-analysis",
  graph: Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["article", "politics"],
      learningObject: ["article", "politics", "cabinet-analysis"],
      lens: ["article", "politics"],
      locale: "en",
    })
  ),
  locale: "en",
  publicPath: "articles/politics/cabinet-analysis",
});

const articleDocument = Schema.decodeUnknownSync(ArticlePreviewDocumentSchema)({
  delivery: "public",
  family: "article",
  rendererDomain: "politics",
  route: articleRoute,
  sourcePath: CorpusSourcePathSchema.make(
    "packages/corpus/articles/politics/merah-putih/cabinet-analysis/en.mdx"
  ),
});

/** Pending state for one real article that a material route must ignore. */
export const articlePendingManifest = Schema.decodeUnknownSync(
  PreviewPendingSchema
)({
  document: articleDocument,
  format: LOCAL_PREVIEW_FORMAT,
  repositories: previewRepositories,
  revision: 1,
  status: "pending",
});
