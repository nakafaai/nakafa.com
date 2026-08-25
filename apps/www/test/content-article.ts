import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { LearningGraphIdentitySchema } from "@nakafa/aksara-contracts/graph/spec";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  ArticleCategorySchema,
  ArticleProjectionSchema,
  ArticleRouteSlugSchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { previewWireArtifact } from "@/test/content-preview";

const category = ArticleCategorySchema.make("politics");

/** Builds one exact article projection for runtime and catalog tests. */
export function makeTestArticleProjection(
  slugValue = "regional-elections-turmoil",
  datePublished = "2024-10-27"
) {
  const articleSlug = ArticleSlugSchema.make(slugValue);
  const publicPath = PublicPathSchema.make(
    `articles/${category}/${articleSlug}`
  );
  return ArticleProjectionSchema.make({
    appLocale: AppLocaleSchema.make("en"),
    articleRouteSlug: ArticleRouteSlugSchema.make(slugValue),
    articleSlug,
    artifactLocale: ArtifactLocaleSchema.make("en"),
    category,
    categoryRouteSlug: ArticleRouteSlugSchema.make(category),
    categoryTitle: "Politics",
    contentKey: ContentKeySchema.make(publicPath),
    graph: LearningGraphIdentitySchema.make({
      alignmentId: `alignment:article:${category}:article:${category}:${articleSlug}`,
      assetId: `asset:en:article:${category}:article:${category}:${articleSlug}`,
      conceptId: `concept:article:${category}`,
      learningObjectId: `lo:article:${category}:${articleSlug}`,
      lensId: `lens:article:${category}`,
    }),
    kind: "article",
    metadata: {
      authors: [{ name: "Shifna Zihdatal Haq" }],
      datePublished,
      description:
        "The political anomaly in Indonesia as it prepares for the 2024 Regional Elections.",
      title:
        "Political Turmoil Ahead of Regional Elections: Politics in Chaos, The People Cry Out",
    },
    official: false,
    parentPath: PublicPathSchema.make(`articles/${category}`),
    publicPath,
    references: [],
    sitemap: true,
  });
}

/** Exact article projection used by published-runtime adapter tests. */
export const testArticleProjection = makeTestArticleProjection();

/** Builds one localized route counterpart for the stable test article. */
export function makeTestArticleCounterpart(
  appLocale: "de" | "en" | "id",
  categoryRouteSlugValue: string,
  articleRouteSlugValue: string
) {
  const categoryRouteSlug = ArticleRouteSlugSchema.make(categoryRouteSlugValue);
  const articleRouteSlug = ArticleRouteSlugSchema.make(articleRouteSlugValue);
  return ArticleProjectionSchema.make({
    ...testArticleProjection,
    appLocale: AppLocaleSchema.make(appLocale),
    articleRouteSlug,
    artifactLocale: ArtifactLocaleSchema.make(appLocale),
    categoryRouteSlug,
    graph: {
      ...testArticleProjection.graph,
      assetId: `asset:${appLocale}:article:${category}:article:${category}:${testArticleProjection.articleSlug}`,
    },
    parentPath: PublicPathSchema.make(`articles/${categoryRouteSlug}`),
    publicPath: PublicPathSchema.make(
      `articles/${categoryRouteSlug}/${articleRouteSlug}`
    ),
  });
}

export const testArticleIdProjection = makeTestArticleCounterpart(
  "id",
  "politics",
  "regional-elections-turmoil"
);
export const testArticleDeProjection = makeTestArticleCounterpart(
  "de",
  "politik",
  "turbulenzen-vor-regionalwahlen"
);

/** Source path corresponding exactly to the technical article fixture. */
export const testArticleSourcePath = CorpusSourcePathSchema.make(
  "packages/corpus/articles/politics/regional-elections/turmoil/en.mdx"
);

/** Signed-wire shape used after cryptographic execution is mocked. */
export const testArticleArtifact = SignedContentArtifactSchema.make({
  ...previewWireArtifact,
  payload: {
    ...previewWireArtifact.payload,
    contentKey: testArticleProjection.contentKey,
    rawMdx:
      "## Political Maneuvers Since the Presidential Election, Will It Continue Until the 2024 Regional Elections?",
    rendererDomain: "politics",
  },
});
