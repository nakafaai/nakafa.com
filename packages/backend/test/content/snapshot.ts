import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { JsonObject } from "@repo/backend/content/snapshot/json";
import { buildRuntimeGenerations } from "@repo/backend/content/snapshot/selection";
import {
  CONTENT_RUNTIME_TABLES,
  type RuntimeRow,
  type RuntimeTable,
} from "@repo/backend/content/snapshot/tables";
import { makeTestPageProjection } from "@repo/backend/test/content/page";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content/release";
import { Effect } from "effect";

export const TEST_SNAPSHOT_RELEASE = testSignedRelease(
  testEmptyManifest(ReleaseIdSchema.make("snapshot-active"))
);

/** Creates a complete empty serving runtime with a real signed release envelope. */
export function makeRuntimeSource(
  signed: SignedContentRelease = TEST_SNAPSHOT_RELEASE,
  resultFamilies: SignedContentRelease["manifest"]["scope"]["families"] = []
) {
  const source = new Map<RuntimeTable, readonly JsonObject[]>(
    CONTENT_RUNTIME_TABLES.map((table) => [table, []])
  );
  const state = {
    activeManifestHash: signed.manifestHash,
    activeReleaseId: signed.manifest.releaseId,
    activeSequence: 9,
    articleManifestHash: signed.manifestHash,
    articleReleaseId: signed.manifest.releaseId,
    articleSequence: 9,
    articleSlot: "blue",
    key: "primary",
    materialManifestHash: signed.manifestHash,
    materialReleaseId: signed.manifest.releaseId,
    materialSequence: 9,
    materialSlot: "blue",
    nextSequence: 10,
    searchManifestHash: signed.manifestHash,
    searchReleaseId: signed.manifest.releaseId,
    searchSequence: 9,
    searchSlot: "blue",
    updatedAt: 100,
  } satisfies RuntimeRow<"contentState">;
  source.set("contentState", [state]);
  source.set("contentReleases", [
    {
      baseFamilies: [],
      checkedIndex: -1,
      checkedItems: 0,
      createdAt: 100,
      releaseId: signed.manifest.releaseId,
      releaseJson: JSON.stringify(signed),
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
      resultFamilies: [...resultFamilies],
      role: "candidate",
      sequence: 9,
      stagedArtifacts: 0,
      stagedDeletes: 0,
      stagedItems: 0,
      stagedProjections: 0,
      stagedRoutes: 0,
      stagedSnapshotBatches: 0,
      stagedSnapshotRows: 0,
      stagedUpserts: 0,
      status: "completed",
      updatedAt: 100,
    } satisfies RuntimeRow<"contentReleases">,
  ]);
  return { source, state };
}

export const TEST_SNAPSHOT_SELECTION_HASH = Effect.runSync(
  buildRuntimeGenerations([makeRuntimeSource().state])
).runtimeSelectionHash;

/** Creates one inherited public head with real signed bytes and its complete serving closure. */
export function makePageRuntimeSource(appLocale: ActiveAppLocaleCode = "en") {
  const fixture = makeRuntimeSource();
  const projection = makeTestPageProjection(appLocale);
  const projectionJson = canonicalizePublicPageProjection(projection);
  const artifact = testSignedArtifact("site", {
    artifactLocale: appLocale,
    contentKey: projection.contentKey,
  });
  const head = {
    artifactHash: artifact.artifactHash,
    artifactLocale: projection.artifactLocale,
    compilerConfigHash: artifact.payload.compilerConfigHash,
    contentKey: projection.contentKey,
    delivery: "public",
    family: "page",
    index: 0,
    operation: "upsert",
    projectionHash: testTextHash(projectionJson),
    projectionJson,
    releaseId: "inherited-release",
    rendererDomain: artifact.payload.rendererDomain,
    sequence: 7,
    sourceHash: artifact.payload.sourceHash,
    sourcePath: projection.sourcePath,
  } satisfies RuntimeRow<"contentHeads">;
  const binding = {
    appLocale: projection.appLocale,
    batchHash: testTextHash("route batch"),
    batchIndex: 0,
    contentKey: projection.contentKey,
    index: 0,
    operation: "bind",
    publicPath: projection.publicPath,
    releaseId: head.releaseId,
    routeJson: testRouteJson({
      appLocale,
      contentKey: projection.contentKey,
      publicPath: projection.publicPath,
      releaseId: head.releaseId,
    }),
    sequence: head.sequence,
  } satisfies RuntimeRow<"contentBindings">;
  fixture.source.set("contentHeads", [head]);
  fixture.source.set("contentBindings", [binding]);
  fixture.source.set("contentArtifacts", [
    {
      artifactHash: artifact.artifactHash,
      artifactJson: JSON.stringify(artifact),
      createdAt: 10,
      retainUntil: 1000,
    },
  ]);
  fixture.source.set("contentKeys", [
    {
      artifactLocale: projection.artifactLocale,
      contentKey: projection.contentKey,
      createdSequence: 7,
      family: "page",
    },
  ]);
  return { ...fixture, artifact, binding, head, projection };
}
