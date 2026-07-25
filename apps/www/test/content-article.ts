import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { LearningGraphIdentitySchema } from "@nakafa/aksara-contracts/graph/spec";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  ArticleProjectionSchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { previewWireArtifact } from "@/test/content-preview";

const category = ArticleCategorySchema.make("politics");

/** Builds one exact article projection for runtime and catalog tests. */
export function makeTestArticleProjection(
  slugValue = "regional-elections-turmoil",
  date = "2024-10-27"
) {
  const articleSlug = ArticleSlugSchema.make(slugValue);
  const publicPath = PublicPathSchema.make(
    `articles/${category}/${articleSlug}`
  );
  return ArticleProjectionSchema.make({
    articleSlug,
    category,
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
    locale: "en",
    metadata: {
      authors: [{ name: "Shifna Zihdatal Haq" }],
      date,
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
