import { RegisteredConvexFunction } from "@confect/server";
import { assert } from "@effect/vitest";
import {
  type ContentFamily,
  ContentFamilySchema,
} from "@nakafa/aksara-contracts/content";
import type { ContentDeliveryClass } from "@nakafa/aksara-contracts/delivery";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ActiveAppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  ArticleCategorySchema,
  ArticleProjectionSchema,
  ArticleRouteSlugSchema,
  ArticleSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { writeArticle } from "@repo/backend/confect/contentRelease/article/write";
import type { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import {
  testArticleGraph,
  testPublicationScope,
  testTextHash,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import {
  insertRuntimeBinding,
  insertRuntimeKey,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime/head";
import {
  TEST_RUNTIME_ENVELOPE,
  TEST_RUNTIME_PATH,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/runtime/values";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

/** Plain codec: parses the same text as JSON.parse, so each expected response keeps its exact values. */
const decodeJson = Schema.decodeUnknownSync(JsonTextSchema);

type RuntimeRow = Exclude<
  FunctionReturnType<
    typeof internal.contentRelease.runtime.publication.internal.read
  >,
  null
>;
export const TEST_ARTICLE_KEY = ContentKeySchema.make(
  "articles/politics/dynastic-politics-asian-values"
);
export const TEST_ARTICLE_PATH = PublicPathSchema.make(TEST_ARTICLE_KEY);
export const TEST_ARTICLE_SOURCE = CorpusSourcePathSchema.make(
  "packages/corpus/articles/politics/dynastic-politics/asian-values/en.mdx"
);
export const TEST_ARTICLE_PROJECTION = ArticleProjectionSchema.make({
  articleRouteSlug: ArticleRouteSlugSchema.make(
    "dynastic-politics-asian-values"
  ),
  articleSlug: ArticleSlugSchema.make("dynastic-politics-asian-values"),
  category: ArticleCategorySchema.make("politics"),
  categoryRouteSlug: ArticleRouteSlugSchema.make("politics"),
  categoryTitle: "Politics",
  contentKey: TEST_ARTICLE_KEY,
  graph: testArticleGraph("dynastic-politics-asian-values"),
  kind: "article",
  appLocale: ActiveAppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  metadata: {
    authors: [
      {
        name: "Nakafa",
      },
    ],
    datePublished: "2026-07-23",
    title: "Article runtime verification",
  },
  official: false,
  parentPath: PublicPathSchema.make("articles/politics"),
  publicPath: TEST_ARTICLE_PATH,
  references: [],
  sitemap: true,
});
export const TEST_ARTICLE_PROJECTION_JSON = canonicalizeArticleProjection(
  TEST_ARTICLE_PROJECTION
);

/** Builds one exact article projection for a synchronization identity. */
export function testArticleProjection(
  index: number,
  datePublished = `2026-07-${index + 10}`
) {
  const articleSlug = ArticleSlugSchema.make(`article-${index}`);
  const contentKey = ContentKeySchema.make(`articles/politics/${articleSlug}`);
  const publicPath = PublicPathSchema.make(contentKey);
  return ArticleProjectionSchema.make({
    ...TEST_ARTICLE_PROJECTION,
    articleRouteSlug: ArticleRouteSlugSchema.make(articleSlug),
    articleSlug,
    contentKey,
    graph: {
      ...TEST_ARTICLE_PROJECTION.graph,
      alignmentId: `alignment:article:politics:article:politics:${articleSlug}`,
      assetId: `asset:en:article:politics:article:politics:${articleSlug}`,
      learningObjectId: `lo:article:politics:${articleSlug}`,
    },
    metadata: {
      authors: TEST_ARTICLE_PROJECTION.metadata.authors,
      datePublished,
      title: `Article ${index}`,
    },
    publicPath,
  });
}

/** Localizes one article route while preserving its canonical content identity. */
export function testLocalizedArticleProjection(
  index: number,
  appLocale: "de" | "en" | "id"
) {
  const projection = testArticleProjection(index);
  const categoryRoute = ArticleRouteSlugSchema.make(
    appLocale === "de" ? "politik" : "politics"
  );
  const articleRoute = ArticleRouteSlugSchema.make(
    appLocale === "de" ? `artikel-${index}` : `article-${index}`
  );
  return ArticleProjectionSchema.make({
    ...projection,
    appLocale: ActiveAppLocaleSchema.make(appLocale),
    articleRouteSlug: articleRoute,
    artifactLocale: ArtifactLocaleSchema.make(appLocale),
    categoryRouteSlug: categoryRoute,
    categoryTitle: appLocale === "en" ? "Politics" : "Politik",
    graph: {
      ...projection.graph,
      assetId: `asset:${appLocale}:article:politics:article:politics:${projection.articleSlug}`,
    },
    parentPath: PublicPathSchema.make(`articles/${categoryRoute}`),
    publicPath: PublicPathSchema.make(
      `articles/${categoryRoute}/${articleRoute}`
    ),
  });
}

/** Builds one realistic material identity for a delivery-specific fixture. */
export function runtimeContentKey(delivery: ContentDeliveryClass) {
  return `material/lesson/test/${delivery}`;
}

/** Creates one exact public runtime request body. */
export function publicRuntimeRequest() {
  return encodeJsonText({
    delivery: "public",
    appLocale: "en",
    publicPath: TEST_RUNTIME_PATH,
  });
}

/** Creates locale and path mismatches for public exchange verification. */
export function runtimeCases(row: RuntimeRow) {
  const response = {
    activeManifestHash: row.activeManifestHash,
    activeReleaseId: row.activeReleaseId,
    artifact: decodeJson(row.artifactJson),
    delivery: row.delivery,
    kind: "found",
    projection: decodeJson(row.projectionJson),
    projectionHash: row.projectionHash,
    release: decodeJson(row.releaseJson),
    rendererManifest: decodeJson(row.rendererJson),
    sourcePath: row.sourcePath,
  };
  const idArtifact = testArtifactJson({
    artifactHash: `sha256:${"3".repeat(64)}`,
    artifactLocale: "id",
    contentKey: runtimeContentKey("public"),
  });
  return [
    [
      "locale",
      {
        ...response,
        artifact: decodeJson(idArtifact),
        projection: decodeJson(
          testProjectionJson({
            contentKey: runtimeContentKey("public"),
            appLocale: "id",
            publicPath: "materi/test/runtime",
          })
        ),
      },
    ],
    [
      "publicPath",
      {
        ...response,
        projection: decodeJson(
          testProjectionJson({
            contentKey: runtimeContentKey("public"),
            publicPath: "subjects/test/foreign",
          })
        ),
      },
    ],
    [
      "sourcePath",
      {
        ...response,
        sourcePath: "packages/corpus/article/test/public/en.mdx",
      },
    ],
  ] as const;
}

/** Inserts the exact completed active release required by runtime reads. */
export async function insertRuntimeRelease(
  ctx: MutationCtx,
  families: readonly ContentFamily[] = ContentFamilySchema.literals
) {
  await insertZeroRelease(ctx, {
    ...TEST_RUNTIME_RELEASE,
    ownership: {
      base: [],
      result: families,
    },
    role: "candidate",
    scope: testPublicationScope({
      families,
    }),
    status: "completed",
  });
  await insertTestState(ctx, {
    active: TEST_RUNTIME_RELEASE,
    nextSequence: TEST_RUNTIME_RELEASE.sequence + 1,
  });
}

/** Inserts active indexed articles through the production writer. */
export async function insertRuntimeArticles(
  ctx: MutationCtx,
  count: number,
  projectionAt: (
    index: number
  ) => ReturnType<typeof testArticleProjection> = testArticleProjection
) {
  await insertRuntimeRelease(ctx);
  const state = await ctx.db.query("contentState").unique();
  assert.ok(state, "Expected one active content state.");
  await ctx.db.patch("contentState", state._id, {
    articleManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
    articleReleaseId: TEST_RUNTIME_RELEASE.releaseId,
    articleSequence: TEST_RUNTIME_RELEASE.sequence,
  });
  for (let index = 0; index < count; index += 1) {
    const projection = projectionAt(index);
    const projectionJson = canonicalizeArticleProjection(projection);
    await insertRuntimeKey(ctx, projection.contentKey, {
      projectionJson,
    });
    await insertRuntimeVersion(ctx, "public", projection.contentKey, {
      artifactHash: testTextHash(
        `${projection.contentKey}/${projection.artifactLocale}`
      ),
      artifactLocale: projection.artifactLocale,
      projectionJson,
      publicPath: projection.publicPath,
      rendererDomain: "politics",
      sourcePath: `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`,
    });
    await insertRuntimeBinding(ctx, projection.contentKey, {
      appLocale: projection.appLocale,
      publicPath: projection.publicPath,
    });
    const head = await ctx.db
      .query("contentHeads")
      .withIndex("by_contentKey_and_artifactLocale_and_sequence", (query) =>
        query
          .eq("contentKey", projection.contentKey)
          .eq("artifactLocale", projection.artifactLocale)
          .eq("sequence", TEST_RUNTIME_RELEASE.sequence)
      )
      .unique();
    assert.ok(head, "Expected one active article head.");
    await Effect.runPromise(
      writeArticle(state.articleSlot, head, projection).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
        )
      )
    );
  }
}

/** Inserts a completed release authenticated by the isolated test key. */
export async function insertSignedRelease(ctx: MutationCtx) {
  await insertRuntimeRelease(ctx);
  const release = await ctx.db.query("contentReleases").unique();
  assert.ok(release, "Expected one runtime release.");
  await ctx.db.patch("contentReleases", release._id, {
    releaseJson: encodeJsonText(TEST_RUNTIME_ENVELOPE),
    rendererJson: encodeJsonText(TEST_PROOF_RENDERER),
  });
}
