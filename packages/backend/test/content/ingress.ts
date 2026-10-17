import { it } from "@effect/vitest";
import {
  CorpusSourcePathSchema,
  GitCommitShaSchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALES,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { digestProjections } from "@nakafa/aksara-contracts/projection/digest";
import {
  canonicalizeMaterialProjection,
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  CONTENT_RELEASE_FORMAT,
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import { MaterialHeadSchema } from "@nakafa/aksara-contracts/release/head";
import { digestResultCatalog } from "@nakafa/aksara-contracts/release/result/digest";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback/digest";
import { RollbackSnapshotEntrySchema } from "@nakafa/aksara-contracts/release/rollback/spec";
import { digestRoutes } from "@nakafa/aksara-contracts/release/route/digest";
import { ContentRouteItemSchema } from "@nakafa/aksara-contracts/release/route/spec";
import {
  inheritContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  testMaterialGraph,
  testMaterialPublicPath,
} from "@repo/backend/test/content/material";
import {
  TEST_PROOF_RENDERER,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  testPublicationScope,
  testTextHash,
} from "@repo/backend/test/content/release";
import { Effect, Stream } from "effect";

export const ingressReleaseId = ReleaseIdSchema.make("release-ingress");
export const ingressRecoveryId = ReleaseIdSchema.make("release-recovery");
const appLocale = ActiveAppLocaleSchema.make("en");
const publicPath = PublicPathSchema.make(testMaterialPublicPath(0));
const sourcePath = CorpusSourcePathSchema.make(
  "packages/corpus/material/lesson/mathematics/technical-heads/head-0/en.mdx"
);

/**
 * Builds the signed material ingress release, its recovery, and every row
 * they name. Each test reads one fresh fixture because signing is async.
 */
export const makeIngressFixture = Effect.fn(
  "test.contentRelease.ingressFixture"
)(function* () {
  const ingressArtifact = yield* testSignedArtifact();
  const ingressItem = ContentReleaseItemSchema.make({
    change: {
      artifactHash: ingressArtifact.artifactHash,
      contentKey: ingressArtifact.payload.contentKey,
      delivery: "public",
      family: "material",
      artifactLocale: ingressArtifact.payload.artifactLocale,
      operation: "upsert",
      rendererDomain: ingressArtifact.payload.rendererDomain,
      sourcePath,
    },
    index: 0,
    releaseId: ingressReleaseId,
  });
  const ingressRoute = ContentRouteItemSchema.make({
    change: {
      contentKey: ingressItem.change.contentKey,
      appLocale,
      operation: "bind",
      publicPath,
    },
    index: 0,
    releaseId: ingressReleaseId,
  });
  const ingressProjection = MaterialLessonProjectionSchema.make({
    contentKey: ingressArtifact.payload.contentKey,
    graph: testMaterialGraph(
      "technical-heads",
      "head-0",
      appLocale,
      "mathematics"
    ),
    kind: "subject-lesson",
    appLocale,
    artifactLocale: ingressArtifact.payload.artifactLocale,
    materialKey: MaterialKeySchema.make("lesson.mathematics.technical-heads"),
    metadata: {
      authors: [{ name: "Nakafa" }],
      datePublished: "2026-07-22",
      title: "Technical Head",
    },
    order: 1,
    parentPath: PublicPathSchema.make("subjects/mathematics/technical-heads"),
    publicPath,
    sectionKey: MaterialSectionSchema.make("head-0"),
    sitemap: true,
    topicTitle: "Technical Head",
  });
  const itemDigest = yield* digestItems(
    ingressReleaseId,
    Stream.make(ingressItem)
  );
  const projectionDigest = yield* digestProjections(
    ingressReleaseId,
    Stream.make(ingressProjection)
  );
  const rollbackDigest = yield* digestRollbackSnapshot(
    ingressReleaseId,
    Stream.make(
      RollbackSnapshotEntrySchema.make({
        index: 0,
        releaseId: ingressReleaseId,
        snapshot: {
          contentKey: ingressItem.change.contentKey,
          family: "material",
          artifactLocale: ingressItem.change.artifactLocale,
          state: "absent",
        },
      })
    )
  );
  const routeDigest = yield* digestRoutes(
    ingressReleaseId,
    Stream.make(ingressRoute)
  );
  const ingressHead = MaterialHeadSchema.make({
    artifactHash: ingressArtifact.artifactHash,
    compilerConfigHash: ingressArtifact.payload.compilerConfigHash,
    contentKey: ingressItem.change.contentKey,
    delivery: "public",
    family: "material",
    artifactLocale: ingressArtifact.payload.artifactLocale,
    projectionHash: testTextHash(
      canonicalizeMaterialProjection(ingressProjection)
    ),
    publicPath,
    rendererDomain: ingressArtifact.payload.rendererDomain,
    sourceHash: ingressArtifact.payload.sourceHash,
    sourcePath,
  });
  const resultDigest = yield* digestResultCatalog(
    ingressReleaseId,
    Stream.make(ingressHead)
  );
  const ingressSnapshots = inheritContentSnapshots(null);

  const ingressRelease = yield* testSignedRelease(
    ContentReleaseManifestSchema.make({
      activeAppLocales: ACTIVE_APP_LOCALES,
      baseActiveAppLocales: null,
      baseManifestHash: null,
      baseReleaseId: null,
      baseResultCount: 0,
      baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
      deleteCount: 0,
      format: CONTENT_RELEASE_FORMAT,
      itemCount: 1,
      itemsDigest: itemDigest.digest,
      origin: { kind: "git", sha: GitCommitShaSchema.make("a".repeat(40)) },
      projectionCount: 1,
      projectionDigest: projectionDigest.digest,
      releaseId: ingressReleaseId,
      rendererManifestHash: TEST_PROOF_RENDERER.hash,
      resultCount: 1,
      resultDigest: resultDigest.digest,
      rollbackCount: 1,
      rollbackDigest: rollbackDigest.digest,
      routeCount: 1,
      routeDigest: routeDigest.digest,
      scope: testPublicationScope({
        families: ["material"],
        snapshots: ingressSnapshots,
      }),
      snapshots: ingressSnapshots,
      upsertCount: 1,
    })
  );

  const ingressRecoveryItem = ContentReleaseItemSchema.make({
    change: {
      contentKey: ingressItem.change.contentKey,
      family: "material",
      artifactLocale: ingressItem.change.artifactLocale,
      operation: "delete",
    },
    index: 0,
    releaseId: ingressRecoveryId,
  });
  const ingressRecoveryRoute = ContentRouteItemSchema.make({
    change: {
      appLocale: ingressRoute.change.appLocale,
      operation: "delete",
      publicPath: ingressRoute.change.publicPath,
    },
    index: 0,
    releaseId: ingressRecoveryId,
  });
  const recoveryItems = yield* digestItems(
    ingressRecoveryId,
    Stream.make(ingressRecoveryItem)
  );
  const recoveryProjections = yield* digestProjections(
    ingressRecoveryId,
    Stream.empty
  );
  const recoveryRollback = yield* digestRollbackSnapshot(
    ingressRecoveryId,
    Stream.make(
      RollbackSnapshotEntrySchema.make({
        index: 0,
        releaseId: ingressRecoveryId,
        snapshot: { head: ingressHead, state: "material" },
      })
    )
  );
  const recoveryRoutes = yield* digestRoutes(
    ingressRecoveryId,
    Stream.make(ingressRecoveryRoute)
  );

  const ingressRecovery = yield* testSignedRelease(
    ContentReleaseManifestSchema.make({
      activeAppLocales: ingressRelease.manifest.activeAppLocales,
      baseActiveAppLocales: ingressRelease.manifest.activeAppLocales,
      baseManifestHash: ingressRelease.manifestHash,
      baseReleaseId: ingressReleaseId,
      baseResultCount: 1,
      baseResultDigest: ingressRelease.manifest.resultDigest,
      deleteCount: 1,
      format: CONTENT_RELEASE_FORMAT,
      itemCount: 1,
      itemsDigest: recoveryItems.digest,
      origin: { kind: "rollback", releaseId: ingressReleaseId },
      projectionCount: 0,
      projectionDigest: recoveryProjections.digest,
      releaseId: ingressRecoveryId,
      rendererManifestHash: TEST_PROOF_RENDERER.hash,
      resultCount: 0,
      resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
      rollbackCount: 1,
      rollbackDigest: recoveryRollback.digest,
      routeCount: 1,
      routeDigest: recoveryRoutes.digest,
      scope: testPublicationScope({ families: ["material"] }),
      snapshots: invertContentSnapshots(ingressRelease.manifest.snapshots),
      upsertCount: 0,
    })
  );

  return {
    ingressArtifact,
    ingressItem,
    ingressProjection,
    ingressRecovery,
    ingressRecoveryItem,
    ingressRecoveryRoute,
    ingressRelease,
    ingressRoute,
  };
});

/** Runs one promise-based ingress test with a freshly signed fixture, so signing stays inside Effect. */
export function itWithIngressFixture(
  name: string,
  body: (
    fixture: Effect.Success<ReturnType<typeof makeIngressFixture>>
  ) => void | Promise<void>
) {
  return it.effect(name, () =>
    Effect.gen(function* () {
      const fixture = yield* makeIngressFixture();
      yield* Effect.promise(async () => body(fixture));
    })
  );
}
