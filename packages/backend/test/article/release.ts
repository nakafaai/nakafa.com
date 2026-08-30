import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  type ArticleProjection,
  ArticleProjectionSchema,
  ArticleRouteSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { INITIAL_MODEL_SLOT } from "@repo/backend/convex/contentRelease/models/slot";
import { insertReleaseItem } from "@repo/backend/test/content/model";
import { testArticleProjection } from "@repo/backend/test/content/runtime";
import type { TestIdentity } from "@repo/backend/test/content/state";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime/head";

/** Inserts one exact article projection and its changed release identity. */
export async function insertArticleProjection(
  ctx: MutationCtx,
  identity: TestIdentity,
  index: number,
  projection: ArticleProjection,
  rendererDomain: RendererDomain = "politics"
) {
  const projectionJson = canonicalizeArticleProjection(projection);
  await insertReleaseItem(
    ctx,
    identity,
    projection.contentKey,
    index,
    "article"
  );
  await insertRuntimeVersion(ctx, "public", projection.contentKey, {
    headReleaseId: identity.releaseId,
    headSequence: identity.sequence,
    projectionJson,
    publicPath: projection.publicPath,
    rendererDomain,
  });
  await insertRuntimeBinding(ctx, projection.contentKey, {
    bindingReleaseId: identity.releaseId,
    bindingSequence: identity.sequence,
    publicPath: projection.publicPath,
  });
}

/** Inserts one exact route-less predecessor article and category pair. */
export async function insertPredecessorArticle(
  ctx: MutationCtx,
  identity: TestIdentity,
  projection: ArticleProjection,
  rendererDomain: RendererDomain = "politics"
) {
  const projectionHash = hashContentProjection(projection);
  await ctx.db.insert("articleCatalog", {
    appLocale: projection.appLocale,
    assetId: projection.graph.assetId,
    bucket: "aaa",
    category: projection.category,
    categoryTitle: projection.categoryTitle,
    contentKey: projection.contentKey,
    datePublished: projection.metadata.datePublished,
    projectionHash,
    publicPath: projection.publicPath,
    releaseId: identity.releaseId,
    rendererDomain,
    sequence: identity.sequence,
    slot: INITIAL_MODEL_SLOT,
  });
  await ctx.db.insert("articleCategories", {
    appLocale: projection.appLocale,
    bucket: "aaa",
    category: projection.category,
    contentKey: projection.contentKey,
    projectionHash,
    releaseId: identity.releaseId,
    rendererDomain,
    sequence: identity.sequence,
    slot: INITIAL_MODEL_SLOT,
    title: projection.categoryTitle,
  });
}

/** Builds one source category with an independently localized public route. */
export function categorizedArticle(options: {
  readonly article: number;
  readonly category: string;
  readonly route: string;
  readonly title: string;
}) {
  const source = testArticleProjection(options.article, "2026-07-23");
  const articleSlug = source.articleSlug;
  const category = ArticleCategorySchema.make(options.category);
  const categoryRouteSlug = ArticleRouteSlugSchema.make(options.route);
  const contentKey = ContentKeySchema.make(
    `articles/${category}/${articleSlug}`
  );
  const lens = `article:${category}`;
  const object = `${lens}:${articleSlug}`;
  return ArticleProjectionSchema.make({
    ...source,
    category,
    categoryRouteSlug,
    categoryTitle: options.title,
    contentKey,
    graph: {
      alignmentId: `alignment:${lens}:${object}`,
      assetId: `asset:en:${lens}:${object}`,
      conceptId: `concept:${lens}`,
      learningObjectId: `lo:${object}`,
      lensId: `lens:${lens}`,
    },
    parentPath: PublicPathSchema.make(`articles/${categoryRouteSlug}`),
    publicPath: PublicPathSchema.make(
      `articles/${categoryRouteSlug}/${source.articleRouteSlug}`
    ),
  });
}
