import type { Ref } from "@confect/core";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
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
import type contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
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
  MutableList,
  Record as Rec,
  Schema,
  Struct,
} from "effect";
import {
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";

const SignedArtifactJsonSchema = Schema.fromJsonString(
  SignedContentArtifactSchema
);

/** Creates signed localized articles with their complete immutable discovery closure. */
export const makeArticleRuntimeSource = Effect.fn(
  "TestContent.articleRuntimeSource"
)(function* () {
  const signed = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("app-article-snapshot")),
    scope: testPublicationScope({ families: ["article"] }),
  });
  const fixture = makeRuntimeSource(signed, signed.manifest.scope.families);
  const projections = Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) => [
    testLocalizedArticleProjection(1, locale),
    testLocalizedArticleProjection(2, locale),
  ]);
  const heads = MutableList.make<PublicationRow<"contentHeads">>();
  const bindings = MutableList.make<PublicationRow<"contentBindings">>();
  const artifacts = MutableList.make<PublicationRow<"contentArtifacts">>();
  const catalog = MutableList.make<PublicationRow<"articleCatalog">>();
  const search = MutableList.make<PublicationRow<"contentIndex">>();
  const categories = MutableHashMap.empty<
    string,
    PublicationRow<"articleCategories">
  >();
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
    MutableList.append(heads, {
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
    MutableList.append(bindings, {
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
    MutableList.append(artifacts, {
      artifactHash: artifact.artifactHash,
      artifactJson: yield* Schema.encodeEffect(SignedArtifactJsonSchema)(
        artifact
      ),
    });
    const bucket = getHashBucket(projectionHash);
    MutableList.append(catalog, {
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
    MutableHashMap.set(
      categories,
      `${projection.appLocale}/${projection.category}`,
      {
        ...identity,
        appLocale: projection.appLocale,
        bucket,
        category: projection.category,
        rendererDomain: "politics",
        route: projection.categoryRouteSlug,
        slot: fixture.state.articleSlot,
        title: projection.categoryTitle,
      }
    );
    MutableList.append(search, {
      ...identity,
      appLocale: projection.appLocale,
      family: "article",
      publicPath: projection.publicPath,
      slot: fixture.state.searchSlot,
      text: projection.metadata.title,
    });
  }
  const catalogRows = MutableList.toArray(catalog);
  const partitionRows = [
    ...Arr.map(catalogRows, (row) => ({ row, article: 1, category: 0 })),
    ...Arr.map([...MutableHashMap.values(categories)], (row) => ({
      row,
      article: 0,
      category: 1,
    })),
  ];
  const buckets: PublicationRow<"articleBuckets">[] = Arr.map(
    Rec.values(
      Arr.groupBy(partitionRows, ({ row }) => `${row.appLocale}/${row.bucket}`)
    ),
    (rows) => ({
      appLocale: rows[0].row.appLocale,
      articleCount: Arr.reduce(rows, 0, (count, item) => count + item.article),
      bucket: rows[0].row.bucket,
      categoryCount: Arr.reduce(
        rows,
        0,
        (count, item) => count + item.category
      ),
      slot: fixture.state.articleSlot,
    })
  );
  MutableHashMap.set(
    fixture.source,
    "contentHeads",
    MutableList.toArray(heads)
  );
  MutableHashMap.set(
    fixture.source,
    "contentBindings",
    MutableList.toArray(bindings)
  );
  MutableHashMap.set(
    fixture.source,
    "contentArtifacts",
    MutableList.toArray(artifacts)
  );
  MutableHashMap.set(fixture.source, "articleCatalog", catalogRows);
  MutableHashMap.set(fixture.source, "articleCategories", [
    ...MutableHashMap.values(categories),
  ]);
  MutableHashMap.set(fixture.source, "articleBuckets", buckets);
  MutableHashMap.set(
    fixture.source,
    "contentIndex",
    MutableList.toArray(search)
  );
  return { ...fixture, projections };
});

export const revision = "a".repeat(40);
export const activeManifestHash = Sha256HashSchema.make(
  `sha256:${"a".repeat(64)}`
);
export const activeReleaseId = ReleaseIdSchema.make("release-article");
type ArticleRow = Ref.Returns<
  typeof contentRelease.article.publications
>["result"]["page"][number];
type CategoryRow = Ref.Returns<
  typeof contentRelease.article.categories
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
