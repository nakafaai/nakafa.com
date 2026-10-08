import { RegisteredConvexFunction } from "@confect/server";
import {
  type ContentFamily,
  ContentFamilySchema,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
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
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { PublicContentRuntimeRequestSchema } from "@nakafa/aksara-contracts/runtime/spec";
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
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type RuntimeRow = Exclude<
  FunctionReturnType<
    typeof internal.contentRelease.runtime.publication.internal.read
  >,
  null
>;
/**
 * The public runtime request contract declares appLocale before delivery, so
 * encoding through the contract would reorder the body. This wire struct takes
 * every field schema from that contract and keeps the body's original order,
 * delivery first.
 */
const PublicRuntimeRequestJsonSchema = Schema.fromJsonString(
  Schema.Struct({
    delivery: PublicContentRuntimeRequestSchema.fields.delivery,
    appLocale: PublicContentRuntimeRequestSchema.fields.appLocale,
    publicPath: PublicContentRuntimeRequestSchema.fields.publicPath,
  })
);
const SignedArtifactJsonSchema = Schema.fromJsonString(
  SignedContentArtifactSchema
);
const ProjectionJsonSchema = Schema.fromJsonString(ContentProjectionSchema);
const SignedReleaseJsonSchema = Schema.fromJsonString(
  SignedContentReleaseSchema
);
const RendererManifestJsonSchema = Schema.fromJsonString(
  RendererManifestEnvelopeSchema
);
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
export function runtimeContentKey(
  delivery: "authenticated" | "entitled" | "public"
) {
  return `material/lesson/test/${delivery}`;
}

/** Creates one exact public runtime request body. */
export function publicRuntimeRequest() {
  return Schema.encodeSync(PublicRuntimeRequestJsonSchema)({
    delivery: "public",
    appLocale: ActiveAppLocaleSchema.make("en"),
    publicPath: PublicPathSchema.make(TEST_RUNTIME_PATH),
  });
}

/** Creates the exact public runtime request for the real pair-grouped article. */
export function articleRuntimeRequest() {
  return Schema.encodeSync(PublicRuntimeRequestJsonSchema)({
    delivery: "public",
    appLocale: ActiveAppLocaleSchema.make("en"),
    publicPath: TEST_ARTICLE_PATH,
  });
}

/** Creates locale and path mismatches for public exchange verification. */
export function runtimeCases(row: RuntimeRow) {
  const response = {
    activeManifestHash: row.activeManifestHash,
    activeReleaseId: row.activeReleaseId,
    artifact: Schema.decodeSync(SignedArtifactJsonSchema)(row.artifactJson),
    delivery: row.delivery,
    kind: "found",
    projection: Schema.decodeSync(ProjectionJsonSchema)(row.projectionJson),
    projectionHash: row.projectionHash,
    release: Schema.decodeSync(SignedReleaseJsonSchema)(row.releaseJson),
    rendererManifest: Schema.decodeSync(RendererManifestJsonSchema)(
      row.rendererJson
    ),
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
        artifact: Schema.decodeSync(SignedArtifactJsonSchema)(idArtifact),
        projection: Schema.decodeSync(ProjectionJsonSchema)(
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
        projection: Schema.decodeSync(ProjectionJsonSchema)(
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
  if (!state) {
    throw new Error("Expected one active content state.");
  }
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
    if (!head) {
      throw new Error("Expected one active article head.");
    }
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
  if (!release) {
    throw new Error("Expected one runtime release.");
  }
  await ctx.db.patch("contentReleases", release._id, {
    releaseJson: Schema.encodeSync(SignedReleaseJsonSchema)(
      TEST_RUNTIME_ENVELOPE
    ),
    rendererJson: Schema.encodeSync(RendererManifestJsonSchema)(
      TEST_PROOF_RENDERER
    ),
  });
}
