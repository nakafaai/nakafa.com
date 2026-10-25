import { StageArtifactBatchInputSchema } from "@nakafa/aksara-contracts/transport/batch";
import {
  MAX_ARTIFACT_BATCH_BYTES,
  MAX_ARTIFACT_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { storeContentArtifact } from "@repo/backend/confect/contentRelease/artifact/store";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/confect/contentRelease/batch";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import {
  loadIdentityItem,
  loadStaged,
} from "@repo/backend/confect/contentRelease/model";
import {
  decodeArtifactHeaderJson,
  decodeItemJson,
  type SignedArtifactHeader,
} from "@repo/backend/confect/contentRelease/parse";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/confect/contentRelease/spec";
import { getConvexSize } from "convex/values";
import { Array as Arr, Clock, Effect, Schema, Struct } from "effect";

/** The batch identity of the shared artifact batch contract, without its artifacts. */
const StageArtifactBatchKeySchema = Schema.Struct(
  Struct.pick(StageArtifactBatchInputSchema.fields, ["batchIndex", "releaseId"])
);

/**
 * Decodes one bounded artifact batch. Each artifact is read only for its staged identity: the
 * Node ingress action decoded, authenticated and canonicalized it before this mutation runs, and
 * activation authenticates every stored body again, so the stored bytes are the action's own.
 */
const decodeBatch = Effect.fn("contentRelease.decodeArtifactBatch")(function* (
  releaseId: string,
  batchIndex: number,
  artifactJson: readonly string[]
) {
  if (
    artifactJson.length === 0 ||
    artifactJson.length > MAX_ARTIFACT_BATCH_COUNT ||
    getConvexSize({
      artifactJson: [...artifactJson],
      batchIndex,
      releaseId,
    }) > MAX_ARTIFACT_BATCH_BYTES
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Artifact batch ${batchIndex} exceeds its bounded transport contract.`
    );
  }
  const entries = yield* Effect.forEach(artifactJson, (source) =>
    decodeArtifactHeaderJson(source).pipe(
      Effect.map((artifact) => ({ artifact, artifactJson: source }))
    )
  );
  yield* Schema.decodeEffect(StageArtifactBatchKeySchema)({
    batchIndex,
    releaseId,
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Artifact batch ${batchIndex} violates its exact contract.`,
        })
    )
  );
  return entries;
});
/** Persists one immutable artifact and marks its exact staged item ready. */
const stageArtifact = Effect.fn("contentRelease.stageArtifact")(function* (
  releaseId: string,
  batchIndex: number,
  batchHash: string,
  artifact: SignedArtifactHeader,
  artifactJson: string,
  now: number
) {
  const writer = yield* DatabaseWriter;
  const item = yield* loadIdentityItem(
    releaseId,
    artifact.payload.contentKey,
    artifact.payload.artifactLocale
  );
  if (!item) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Artifact ${artifact.artifactHash} has no staged item.`
    );
  }
  if (item.artifactReady) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Artifact ${artifact.artifactHash} was already staged in another batch.`
    );
  }
  const decodedItem = yield* decodeItemJson(item.itemJson);
  if (
    decodedItem.change.operation !== "upsert" ||
    decodedItem.change.artifactHash !== artifact.artifactHash ||
    decodedItem.change.rendererDomain !== artifact.payload.rendererDomain
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Artifact ${artifact.artifactHash} does not match its staged upsert.`
    );
  }
  const stored = yield* storeContentArtifact(
    artifact,
    artifactJson,
    now + ROLLBACK_RETENTION_MS
  );
  // Confect patch re-reads the whole row before replacing it, so replace
  // the row loaded above instead of reading it again per staged artifact.
  yield* writer
    .table("contentItems")
    .replace(item._id, {
      ...Struct.omit(item, ["_id", "_creationTime"]),
      artifactBatchHash: batchHash,
      artifactBatchIndex: batchIndex,
      artifactReady: true,
    })
    .pipe(Effect.orDie);
  return stored;
});
/** Stages one canonical artifact batch with exact immutable retry identity. */
export const stageProgram = Effect.fn("contentRelease.stageArtifactBatch")(
  function* (
    releaseId: string,
    batchIndex: number,
    sources: readonly string[]
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const entries = yield* decodeBatch(releaseId, batchIndex, sources);
    const values = Arr.map(entries, ({ artifactJson }) => artifactJson);
    const identities = Arr.dedupe(
      Arr.map(entries, ({ artifact }) => artifact.artifactHash)
    );
    if (identities.length !== entries.length) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Artifact batch ${batchIndex} repeats one immutable hash.`
      );
    }
    const batchHash = yield* hashBatch(
      "artifact",
      releaseId,
      batchIndex,
      values
    );
    const { release } = yield* loadStaged(releaseId);
    if (release.status !== "staging" || release.abortingAt !== undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} no longer accepts artifact batches.`
      );
    }
    const existing = yield* database
      .table("contentItems")
      .index("by_releaseId_and_artifactBatchIndex", (query) =>
        query.eq("releaseId", releaseId).eq("artifactBatchIndex", batchIndex)
      )
      .take(MAX_ARTIFACT_BATCH_COUNT + 1)
      .pipe(Effect.orDie);
    if (existing.length > 0) {
      yield* validateStoredBatch(
        existing.length,
        values.length,
        Arr.map(existing, ({ artifactBatchHash }) => artifactBatchHash),
        batchHash,
        releaseId,
        batchIndex
      );
      return {
        batchIndex,
        created: 0,
        releaseId,
        unchanged: values.length,
      };
    }
    if (release.stagedArtifacts + values.length > release.stagedUpserts) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Artifact batch ${batchIndex} exceeds staged upserts.`
      );
    }
    const now = yield* Clock.currentTimeMillis;
    let unchanged = 0;
    for (const { artifact, artifactJson } of entries) {
      if (
        yield* stageArtifact(
          releaseId,
          batchIndex,
          batchHash,
          artifact,
          artifactJson,
          now
        )
      ) {
        unchanged += 1;
      }
    }
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        stagedArtifacts: release.stagedArtifacts + values.length,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      batchIndex,
      created: values.length - unchanged,
      releaseId,
      unchanged,
    };
  }
);
