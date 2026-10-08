import type { Ref } from "@confect/core";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  activeAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import {
  ArticleRouteSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import type refs from "@repo/backend/confect/_generated/refs";
import { getHashBucket } from "@repo/backend/confect/contentRelease/bucket";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { makeRuntimeSource } from "@repo/backend/test/content/publication";
import {
  testPublicationScope,
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content/release";
import { testLocalizedArticleProjection } from "@repo/backend/test/content/runtime";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  Record as Rec,
  Struct,
} from "effect";
import {
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";

/** Creates signed localized articles with their complete immutable discovery closure. */
export const makeArticleRuntimeSource = Effect.fn(
  "TestContent.articleRuntimeSource"
)(() =>
  Effect.sync(() => {
    const signed = testSignedRelease({
      ...testEmptyManifest(ReleaseIdSchema.make("app-article-snapshot")),
      scope: testPublicationScope({ families: ["article"] }),
    });
    const fixture = makeRuntimeSource(signed, signed.manifest.scope.families);
    const projections = ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
      testLocalizedArticleProjection(1, locale),
      testLocalizedArticleProjection(2, locale),
    ]);
    const heads: PublicationRow<"contentHeads">[] = [];
    const bindings: PublicationRow<"contentBindings">[] = [];
    const artifacts: PublicationRow<"contentArtifacts">[] = [];
    const catalog: PublicationRow<"articleCatalog">[] = [];
    const search: PublicationRow<"contentIndex">[] = [];
    const categories = new Map<string, PublicationRow<"articleCategories">>();
    for (const [index, projection] of projections.entries()) {
      const artifact = testSignedArtifact("politics", {
        artifactLocale: activeAppLocaleCode(projection.appLocale),
        contentKey: projection.contentKey,
      });
      const projectionHash = hashContentProjection(projection);
      const identity = {
        contentKey: projection.contentKey,
        projectionHash,
        releaseId: signed.manifest.releaseId,
        sequence: fixture.state.activeSequence,
      };
      heads.push({
        ...identity,
        artifactHash: artifact.artifactHash,
        artifactLocale: projection.artifactLocale,
        compilerConfigHash: artifact.payload.compilerConfigHash,
        delivery: "public",
        family: "article",
        index,
        operation: "upsert",
        projectionJson: canonicalizeArticleProjection(projection),
        rendererDomain: "politics",
        sourceHash: artifact.payload.sourceHash,
        sourcePath: `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`,
      });
      bindings.push({
        appLocale: projection.appLocale,
        batchHash: testTextHash("article snapshot routes"),
        batchIndex: 0,
        contentKey: projection.contentKey,
        index,
        operation: "bind",
        publicPath: projection.publicPath,
        releaseId: signed.manifest.releaseId,
        routeJson: testRouteJson({
          appLocale: projection.appLocale,
          contentKey: projection.contentKey,
          index,
          publicPath: projection.publicPath,
          releaseId: signed.manifest.releaseId,
        }),
        sequence: fixture.state.activeSequence,
      });
      artifacts.push({
        artifactHash: artifact.artifactHash,
        artifactJson: JSON.stringify(artifact),
      });
      const bucket = getHashBucket(projectionHash);
      catalog.push({
        ...identity,
        ...Struct.pick(projection.metadata, ["dateModified"]),
        appLocale: projection.appLocale,
        assetId: projection.graph.assetId,
        bucket,
        category: projection.category,
        categoryTitle: projection.categoryTitle,
        datePublished: projection.metadata.datePublished,
        publicPath: projection.publicPath,
        rendererDomain: "politics",
        slot: fixture.state.articleSlot,
      });
      categories.set(`${projection.appLocale}/${projection.category}`, {
        ...identity,
        appLocale: projection.appLocale,
        bucket,
        category: projection.category,
        rendererDomain: "politics",
        route: projection.categoryRouteSlug,
        slot: fixture.state.articleSlot,
        title: projection.categoryTitle,
      });
      search.push({
        ...identity,
        appLocale: projection.appLocale,
        family: "article",
        publicPath: projection.publicPath,
        slot: fixture.state.searchSlot,
        text: projection.metadata.title,
      });
    }
    const partitionRows = [
      ...catalog.map((row) => ({ row, article: 1, category: 0 })),
      ...[...categories.values()].map((row) => ({
        row,
        article: 0,
        category: 1,
      })),
    ];
    const buckets: PublicationRow<"articleBuckets">[] = Rec.values(
      Arr.groupBy(partitionRows, ({ row }) => `${row.appLocale}/${row.bucket}`)
    ).map((rows) => ({
      appLocale: rows[0].row.appLocale,
      articleCount: rows.reduce((count, item) => count + item.article, 0),
      bucket: rows[0].row.bucket,
      categoryCount: rows.reduce((count, item) => count + item.category, 0),
      slot: fixture.state.articleSlot,
    }));
    MutableHashMap.set(fixture.source, "contentHeads", heads);
    MutableHashMap.set(fixture.source, "contentBindings", bindings);
    MutableHashMap.set(fixture.source, "contentArtifacts", artifacts);
    MutableHashMap.set(fixture.source, "articleCatalog", catalog);
    MutableHashMap.set(fixture.source, "articleCategories", [
      ...categories.values(),
    ]);
    MutableHashMap.set(fixture.source, "articleBuckets", buckets);
    MutableHashMap.set(fixture.source, "contentIndex", search);
    return { ...fixture, projections };
  })
);

export const revision = "a".repeat(40);
export const activeManifestHash = Sha256HashSchema.make(
  `sha256:${"a".repeat(64)}`
);
export const activeReleaseId = ReleaseIdSchema.make("release-article");
type ArticleRow = Ref.Returns<
  typeof refs.public.contentRelease.article.publications
>["result"]["page"][number];
type CategoryRow = Ref.Returns<
  typeof refs.public.contentRelease.article.categories
>["result"]["page"][number];

/** Builds one backend projection row from a reviewed article projection. */
export function articleRow(selected = testArticleProjection): ArticleRow {
  return {
    appLocale: selected.appLocale,
    artifactLocale: selected.artifactLocale,
    contentKey: selected.contentKey,
    family: "article",
    projectionHash: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
    projectionJson: canonicalizeArticleProjection(selected),
    publicPath: selected.publicPath,
    releaseId: "release-article",
    rendererDomain: "politics",
    sequence: 2,
    sourcePath: testArticleSourcePath,
  };
}

/** Builds one successful article page from the active read model. */
export function articlePage(overrides?: {
  readonly isDone?: boolean;
  readonly page?: readonly unknown[];
  readonly sourceRevision?: null | string;
  readonly stale?: boolean;
}) {
  return {
    activeManifestHash,
    activeReleaseId,
    managed: true,
    result: {
      continueCursor: "next",
      isDone: overrides?.isDone ?? true,
      page: overrides?.page ?? [articleRow()],
    },
    sourceRevision:
      overrides?.sourceRevision === undefined
        ? revision
        : overrides.sourceRevision,
    stale: overrides?.stale ?? false,
  };
}

/** Builds one backend category row from reviewed article metadata. */
export function categoryRow(overrides?: {
  readonly category?: string;
  readonly route?: string;
  readonly title?: string;
}): CategoryRow {
  return {
    category: overrides?.category ?? "politics",
    rendererDomain: "politics",
    route: ArticleRouteSlugSchema.make(overrides?.route ?? "politics"),
    title: overrides?.title ?? "Politics",
  };
}

/** Builds one successful category page from the active read model. */
export function categoryPage(overrides?: {
  readonly category?: string;
  readonly isDone?: boolean;
  readonly stale?: boolean;
  readonly title?: string;
}) {
  return {
    activeManifestHash,
    activeReleaseId,
    managed: true,
    result: {
      continueCursor: "next",
      isDone: overrides?.isDone ?? true,
      page: [categoryRow(overrides)],
    },
    sourceRevision: revision,
    stale: overrides?.stale ?? false,
  };
}
