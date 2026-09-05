import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  activeAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import type { RuntimeRow } from "@repo/backend/content/snapshot/tables";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
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
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Array as Arr, Effect, Struct } from "effect";

const defaultProjections = ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
  makeMaterialProjection(locale, 1),
  makeMaterialProjection(locale, 2),
]);

/** Creates signed material bytes and their complete immutable serving closure. */
export const makeMaterialRuntimeSource = Effect.fn(
  "TestContent.materialRuntimeSource"
)(function* (
  projections: readonly MaterialLessonProjection[] = defaultProjections
) {
  const signed = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("app-material-snapshot")),
    scope: testPublicationScope({ families: ["material"] }),
  });
  const fixture = makeRuntimeSource(signed, signed.manifest.scope.families);
  const heads: RuntimeRow<"contentHeads">[] = [];
  const bindings: RuntimeRow<"contentBindings">[] = [];
  const artifacts: RuntimeRow<"contentArtifacts">[] = [];
  const catalog: RuntimeRow<"materialCatalog">[] = [];
  const search: RuntimeRow<"contentIndex">[] = [];
  for (const [index, projection] of projections.entries()) {
    const artifact = testSignedArtifact("mathematics", {
      artifactLocale: activeAppLocaleCode(projection.appLocale),
      contentKey: projection.contentKey,
    });
    const projectionHash = hashContentProjection(projection);
    const projectionJson = canonicalizeMaterialProjection(projection);
    const sourcePath = `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`;
    const publicIdentity = {
      contentKey: projection.contentKey,
      projectionHash,
      publicPath: projection.publicPath,
      releaseId: signed.manifest.releaseId,
      sequence: fixture.state.activeSequence,
    };
    heads.push({
      ...Struct.omit(publicIdentity, ["publicPath"]),
      artifactHash: artifact.artifactHash,
      artifactLocale: projection.artifactLocale,
      compilerConfigHash: artifact.payload.compilerConfigHash,
      delivery: "public",
      family: "material",
      index,
      operation: "upsert",
      projectionJson,
      rendererDomain: "mathematics",
      sourceHash: artifact.payload.sourceHash,
      sourcePath,
    });
    bindings.push({
      appLocale: projection.appLocale,
      batchHash: testTextHash("material snapshot routes"),
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
    const topic = yield* deriveMaterialTopicReference(projection);
    const bucket = getHashBucket(projectionHash);
    catalog.push({
      ...publicIdentity,
      appLocale: projection.appLocale,
      assetId: projection.graph.assetId,
      bucket,
      ...Struct.pick(projection.metadata, ["dateModified"]),
      datePublished: projection.metadata.datePublished,
      materialKey: projection.materialKey,
      order: projection.order,
      parentPath: projection.parentPath,
      projectionJson,
      rendererDomain: "mathematics",
      slot: fixture.state.materialSlot,
      sourcePath,
      topicAssetId: topic.graph.assetId,
    });
    search.push({
      ...publicIdentity,
      appLocale: projection.appLocale,
      family: "material",
      slot: fixture.state.searchSlot,
      text: projection.metadata.title,
    });
  }
  const buckets = Object.values(
    Arr.groupBy(catalog, (row) => `${row.appLocale}/${row.bucket}`)
  ).map((rows) => ({
    appLocale: rows[0].appLocale,
    bucket: rows[0].bucket,
    count: rows.length,
    slot: fixture.state.materialSlot,
  }));
  fixture.source.set("contentHeads", heads);
  fixture.source.set("contentBindings", bindings);
  fixture.source.set("contentArtifacts", artifacts);
  fixture.source.set("materialCatalog", catalog);
  fixture.source.set("materialBuckets", buckets);
  fixture.source.set("contentIndex", search);
  return { ...fixture, projections };
});
