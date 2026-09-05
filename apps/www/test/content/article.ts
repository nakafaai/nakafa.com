import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  activeAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import type { RuntimeRow } from "@repo/backend/content/snapshot/tables";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import {
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  testPublicationScope,
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content/release";
import { testLocalizedArticleProjection } from "@repo/backend/test/content/runtime";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Array as Arr, Effect, Struct } from "effect";

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
    const heads: RuntimeRow<"contentHeads">[] = [];
    const bindings: RuntimeRow<"contentBindings">[] = [];
    const artifacts: RuntimeRow<"contentArtifacts">[] = [];
    const catalog: RuntimeRow<"articleCatalog">[] = [];
    const search: RuntimeRow<"contentIndex">[] = [];
    const categories = new Map<string, RuntimeRow<"articleCategories">>();
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
        createdAt: 1,
        retainUntil: 100,
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
    const buckets: RuntimeRow<"articleBuckets">[] = Object.values(
      Arr.groupBy(partitionRows, ({ row }) => `${row.appLocale}/${row.bucket}`)
    ).map((rows) => ({
      appLocale: rows[0].row.appLocale,
      articleCount: rows.reduce((count, item) => count + item.article, 0),
      bucket: rows[0].row.bucket,
      categoryCount: rows.reduce((count, item) => count + item.category, 0),
      slot: fixture.state.articleSlot,
    }));
    fixture.source.set("contentHeads", heads);
    fixture.source.set("contentBindings", bindings);
    fixture.source.set("contentArtifacts", artifacts);
    fixture.source.set("articleCatalog", catalog);
    fixture.source.set("articleCategories", [...categories.values()]);
    fixture.source.set("articleBuckets", buckets);
    fixture.source.set("contentIndex", search);
    return { ...fixture, projections };
  })
);
