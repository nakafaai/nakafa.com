import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
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
import { getHashBucket } from "@repo/backend/confect/contentRelease/bucket";
import { deriveMaterialTopicReference } from "@repo/backend/confect/contentRelease/material/topic";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
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
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableList,
  Record as Rec,
  Schema,
  Struct,
} from "effect";

const SignedArtifactJsonSchema = Schema.fromJsonString(
  SignedContentArtifactSchema
);

const defaultProjections = Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) => [
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
  const heads = MutableList.make<PublicationRow<"contentHeads">>();
  const bindings = MutableList.make<PublicationRow<"contentBindings">>();
  const artifacts = MutableList.make<PublicationRow<"contentArtifacts">>();
  const catalog = MutableList.make<PublicationRow<"materialCatalog">>();
  const search = MutableList.make<PublicationRow<"contentIndex">>();
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
    MutableList.append(heads, {
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
    MutableList.append(bindings, {
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
    MutableList.append(artifacts, {
      artifactHash: artifact.artifactHash,
      artifactJson: yield* Schema.encodeEffect(SignedArtifactJsonSchema)(
        artifact
      ),
    });
    const topic = yield* deriveMaterialTopicReference(projection);
    const bucket = getHashBucket(projectionHash);
    MutableList.append(catalog, {
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
    MutableList.append(search, {
      ...publicIdentity,
      appLocale: projection.appLocale,
      family: "material",
      slot: fixture.state.searchSlot,
      text: projection.metadata.title,
    });
  }
  const catalogRows = MutableList.toArray(catalog);
  const buckets = Arr.map(
    Rec.values(
      Arr.groupBy(catalogRows, (row) => `${row.appLocale}/${row.bucket}`)
    ),
    (rows) => ({
      appLocale: rows[0].appLocale,
      bucket: rows[0].bucket,
      count: rows.length,
      slot: fixture.state.materialSlot,
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
  MutableHashMap.set(fixture.source, "materialCatalog", catalogRows);
  MutableHashMap.set(fixture.source, "materialBuckets", buckets);
  MutableHashMap.set(
    fixture.source,
    "contentIndex",
    MutableList.toArray(search)
  );
  return { ...fixture, projections };
});
