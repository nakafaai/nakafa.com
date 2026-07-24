import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleProjectionSchema,
  ArticleSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import type { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  testSignedRelease as signRelease,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
} from "@repo/backend/test/content-proof";
import {
  testArticleGraph,
  testProjectionJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import type { FunctionReturnType } from "convex/server";

type RuntimeRow = Exclude<
  FunctionReturnType<typeof internal.contentRelease.runtime.readPublic>,
  null
>;

export const TEST_RUNTIME_NOW = Date.UTC(2026, 6, 23, 12);
export const TEST_RUNTIME_PATH = "test/runtime";
export const TEST_ARTICLE_KEY = ContentKeySchema.make(
  "articles/politics/dynastic-politics-asian-values"
);
export const TEST_ARTICLE_PATH = PublicPathSchema.make(TEST_ARTICLE_KEY);
export const TEST_ARTICLE_SOURCE = CorpusSourcePathSchema.make(
  "packages/corpus/articles/politics/dynastic-politics/asian-values/en.mdx"
);
export const TEST_ARTICLE_PROJECTION = ArticleProjectionSchema.make({
  articleSlug: ArticleSlugSchema.make("dynastic-politics-asian-values"),
  category: "politics",
  contentKey: TEST_ARTICLE_KEY,
  graph: testArticleGraph("dynastic-politics-asian-values"),
  kind: "article",
  locale: "en",
  metadata: {
    authors: [{ name: "Nakafa" }],
    date: "2026-07-23",
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
const runtimeReleaseId = ReleaseIdSchema.make("release-runtime");
const signedRuntimeRelease = signRelease(testEmptyManifest(runtimeReleaseId));
export const TEST_RUNTIME_RELEASE = {
  manifestHash: signedRuntimeRelease.manifestHash,
  releaseId: runtimeReleaseId,
  sequence: 3,
} satisfies TestIdentity;

/** Builds one realistic material identity for a delivery-specific fixture. */
export function runtimeContentKey(
  delivery: "authenticated" | "entitled" | "public"
) {
  return `material/lesson/test/${delivery}`;
}

/** Creates one exact runtime request body for an access class. */
export function runtimeRequest(
  delivery: "authenticated" | "entitled" | "public"
) {
  return JSON.stringify({
    delivery,
    locale: "en",
    publicPath: TEST_RUNTIME_PATH,
  });
}

/** Creates the exact public runtime request for the real pair-grouped article. */
export function articleRuntimeRequest() {
  return JSON.stringify({
    delivery: "public",
    locale: "en",
    publicPath: TEST_ARTICLE_PATH,
  });
}

/** Creates delivery, locale, and path mismatches for exchange verification. */
export function runtimeCases(row: RuntimeRow) {
  const response = {
    activeManifestHash: row.activeManifestHash,
    activeReleaseId: row.activeReleaseId,
    artifact: JSON.parse(row.artifactJson),
    delivery: row.delivery,
    kind: "found",
    projection: JSON.parse(row.projectionJson),
    projectionHash: row.projectionHash,
    release: JSON.parse(row.releaseJson),
    rendererManifest: JSON.parse(row.rendererJson),
    sourcePath: row.sourcePath,
  };
  const idArtifact = testArtifactJson({
    artifactHash: `sha256:${"3".repeat(64)}`,
    contentKey: runtimeContentKey("public"),
    locale: "id",
  });
  return [
    ["delivery", { ...response, delivery: "authenticated" }],
    [
      "locale",
      {
        ...response,
        artifact: JSON.parse(idArtifact),
        projection: JSON.parse(
          testProjectionJson({
            contentKey: runtimeContentKey("public"),
            locale: "id",
            publicPath: TEST_RUNTIME_PATH,
          })
        ),
      },
    ],
    [
      "publicPath",
      {
        ...response,
        projection: JSON.parse(
          testProjectionJson({
            contentKey: runtimeContentKey("public"),
            publicPath: "test/foreign",
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
  identity = TEST_RUNTIME_RELEASE
) {
  await insertZeroRelease(ctx, {
    ...identity,
    role: "candidate",
    status: "completed",
  });
  await insertTestState(ctx, {
    active: identity,
    nextSequence: identity.sequence + 1,
  });
}

/** Inserts a completed release authenticated by the isolated test key. */
export async function insertSignedRelease(ctx: MutationCtx) {
  await insertRuntimeRelease(ctx);
  const release = await ctx.db.query("contentReleases").unique();
  if (!release) {
    throw new Error("Expected one runtime release.");
  }
  await ctx.db.patch("contentReleases", release._id, {
    releaseJson: JSON.stringify(signedRuntimeRelease),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
  });
}
