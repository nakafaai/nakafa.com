import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  type ReleaseId,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { digestProjections } from "@nakafa/aksara-contracts/projection/digest";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import {
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import { ContentHeadSchema } from "@nakafa/aksara-contracts/release/head";
import { digestResultCatalog } from "@nakafa/aksara-contracts/release/result/digest";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback/digest";
import { RollbackSnapshotEntrySchema } from "@nakafa/aksara-contracts/release/rollback/spec";
import { digestRoutes } from "@nakafa/aksara-contracts/release/route/digest";
import { ContentRouteItemSchema } from "@nakafa/aksara-contracts/release/route/spec";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { MAX_ITEM_BATCH_COUNT } from "@nakafa/aksara-contracts/transport/limits";
import { stageProgram as stageArtifacts } from "@repo/backend/confect/contentRelease/artifacts";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import { stageItemProgram } from "@repo/backend/confect/contentRelease/items";
import { stageProgram as stageRelease } from "@repo/backend/confect/contentRelease/manifest";
import { stageProjectionProgram } from "@repo/backend/confect/contentRelease/projection";
import { stageProgram as stageRoutes } from "@repo/backend/confect/contentRelease/routes";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { Effect, Schema, Stream } from "effect";

/** Encodes fixture JSON with the contracts production decodes, so each stored string has the wire shape production reads. */
const encodeArtifactJson = Schema.encodeSync(
  Schema.fromJsonString(SignedContentArtifactSchema),
  { onExcessProperty: "error" }
);
const encodeItemJson = Schema.encodeSync(
  Schema.fromJsonString(ContentReleaseItemSchema),
  { onExcessProperty: "error" }
);
const encodeReleaseJson = Schema.encodeSync(
  Schema.fromJsonString(SignedContentReleaseSchema),
  { onExcessProperty: "error" }
);
const encodeRendererJson = Schema.encodeSync(
  Schema.fromJsonString(RendererManifestEnvelopeSchema),
  { onExcessProperty: "error" }
);
const encodeRouteJson = Schema.encodeSync(
  Schema.fromJsonString(ContentRouteItemSchema),
  { onExcessProperty: "error" }
);

/** Stages a complete authenticated genesis release across real bounded batches. */
export const stagePagedRelease = Effect.fn("backendTest.stagePagedRelease")(
  function* (count: number, releaseId: ReleaseId) {
    const entries = yield* Effect.forEach(
      Array.from(
        {
          length: count,
        },
        (_, index) => index
      ),
      Effect.fn("backendTest.pagedReleaseEntry")(function* (index) {
        const contentKey = ContentKeySchema.make(
          `test:proof-${String(index).padStart(3, "0")}`
        );
        const sourcePath = CorpusSourcePathSchema.make(
          `packages/corpus/test/proof-${index}/en.mdx`
        );
        const artifact = testSignedArtifact("mathematics", {
          contentKey,
        });
        const projectionJson = testProjectionJson({
          contentKey,
          index,
        });
        const projection = yield* Schema.decodeEffect(
          Schema.fromJsonString(MaterialLessonProjectionSchema)
        )(projectionJson);
        const item = ContentReleaseItemSchema.make({
          change: {
            artifactHash: artifact.artifactHash,
            artifactLocale: projection.artifactLocale,
            contentKey,
            delivery: "public",
            family: "material",
            operation: "upsert",
            rendererDomain: "mathematics",
            sourcePath,
          },
          index,
          releaseId,
        });
        const head = ContentHeadSchema.make({
          artifactHash: artifact.artifactHash,
          artifactLocale: projection.artifactLocale,
          compilerConfigHash: artifact.payload.compilerConfigHash,
          contentKey,
          delivery: "public",
          family: "material",
          projectionHash: Sha256HashSchema.make(
            yield* hashText("test projection", projectionJson)
          ),
          publicPath: projection.publicPath,
          rendererDomain: "mathematics",
          sourceHash: artifact.payload.sourceHash,
          sourcePath,
        });
        const rollback = RollbackSnapshotEntrySchema.make({
          index,
          releaseId,
          snapshot: {
            artifactLocale: projection.artifactLocale,
            contentKey,
            family: "material",
            state: "absent",
          },
        });
        return {
          artifact,
          head,
          item,
          projection,
          projectionJson,
          rollback,
        };
      })
    );
    const routes = [...entries]
      .sort((left, right) =>
        left.projection.publicPath < right.projection.publicPath ? -1 : 1
      )
      .map(({ projection }, index) =>
        ContentRouteItemSchema.make({
          change: {
            appLocale: projection.appLocale,
            contentKey: projection.contentKey,
            operation: "bind",
            publicPath: projection.publicPath,
          },
          index,
          releaseId,
        })
      );
    const digests = yield* Effect.all({
      items: digestItems(
        releaseId,
        Stream.fromIterable(entries.map(({ item }) => item))
      ),
      projections: digestProjections(
        releaseId,
        Stream.fromIterable(entries.map(({ projection }) => projection))
      ),
      result: digestResultCatalog(
        releaseId,
        Stream.fromIterable(entries.map(({ head }) => head))
      ),
      rollback: digestRollbackSnapshot(
        releaseId,
        Stream.fromIterable(entries.map(({ rollback }) => rollback))
      ),
      routes: digestRoutes(releaseId, Stream.fromIterable(routes)),
    });
    const signed = testSignedRelease(
      ContentReleaseManifestSchema.make({
        ...testEmptyManifest(releaseId),
        itemCount: count,
        itemsDigest: digests.items.digest,
        projectionCount: count,
        projectionDigest: digests.projections.digest,
        resultCount: count,
        resultDigest: digests.result.digest,
        rollbackCount: count,
        rollbackDigest: digests.rollback.digest,
        routeCount: count,
        routeDigest: digests.routes.digest,
        upsertCount: count,
      })
    );
    yield* stageRelease(
      "candidate",
      encodeReleaseJson(signed),
      encodeRendererJson(TEST_PROOF_RENDERER)
    );
    for (let start = 0; start < count; start += MAX_ITEM_BATCH_COUNT) {
      const batchIndex = start / MAX_ITEM_BATCH_COUNT;
      const batch = entries.slice(start, start + MAX_ITEM_BATCH_COUNT);
      yield* stageItemProgram(
        releaseId,
        batchIndex,
        batch.map(({ item }) => encodeItemJson(item))
      );
      yield* stageArtifacts(
        releaseId,
        batchIndex,
        batch.map(({ artifact }) => encodeArtifactJson(artifact))
      );
      yield* stageProjectionProgram(
        releaseId,
        batchIndex,
        batch.map(({ projectionJson }) => projectionJson)
      );
    }
    for (let start = 0; start < count; start += MAX_ITEM_BATCH_COUNT) {
      yield* stageRoutes(
        releaseId,
        start / MAX_ITEM_BATCH_COUNT,
        routes
          .slice(start, start + MAX_ITEM_BATCH_COUNT)
          .map((route) => encodeRouteJson(route))
      );
    }
    return signed.manifestHash;
  }
);
