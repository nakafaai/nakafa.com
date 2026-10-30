import { canonicalizeContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import {
  type ContentDeleteSchema,
  ContentUpsertSchema,
} from "@nakafa/aksara-contracts/release";
import { canonicalizeContentChange } from "@nakafa/aksara-contracts/release/canonical";
import {
  type RollbackRecord,
  type RollbackUpsertState,
  RollbackUpsertStateSchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { requireCurrentArtifact } from "@repo/backend/confect/contentRelease/generation";
import { loadExactVersion } from "@repo/backend/confect/contentRelease/model";
import {
  decodeItemJson,
  decodeRollbackJson,
  parseStoredJson,
} from "@repo/backend/confect/contentRelease/parse";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

type UpsertChange = typeof ContentUpsertSchema.Type;
type DeleteChange = typeof ContentDeleteSchema.Type;
/** Writes one change in the form the contract canonicalizes inside a rollback state. */
function changeText(change: UpsertChange | DeleteChange) {
  return encodeJsonText(canonicalizeContentChange(change));
}
/**
 * Pairs one decoded delete state with the text its page entry carries, which is its change alone.
 */
function deleteWritten(change: DeleteChange) {
  return { state: { change }, text: `{"change":${changeText(change)}}` };
}
/**
 * Pairs one decoded body-bearing state with the text its page entry carries. Ingress stores each
 * artifact in the canonical form the contract writes, so the page reuses those bytes instead of
 * encoding the signed tree again.
 */
function upsertWritten(state: RollbackUpsertState, artifactJson: string) {
  return {
    state,
    text: `{"artifact":${artifactJson},"change":${changeText(state.change)},"projection":${canonicalizeContentProjection(state.projection)}}`,
  };
}
/** Loads one immutable signed artifact required by a rollback state, parsed once. */
const loadArtifact = Effect.fn("contentRelease.loadRollbackArtifact")(
  function* (artifactHash: string, identity: string) {
    const database = yield* DatabaseReader;
    const stored = yield* database
      .table("contentArtifacts")
      .get("by_artifactHash", artifactHash)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!stored) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Rollback state ${identity} lost artifact ${artifactHash}.`
      );
    }
    const artifact = yield* parseStoredJson(
      stored.artifactJson,
      "Signed artifact"
    );
    yield* requireCurrentArtifact(artifact, identity, artifactHash);
    return { artifact, artifactJson: stored.artifactJson };
  }
);
/**
 * Decodes one complete body-bearing rollback state from its stored JSON in one strict pass, and
 * writes its page text from the stored artifact bytes.
 */
const upsertState = Effect.fn("contentRelease.rollbackUpsertState")(function* (
  change: UpsertChange,
  projectionJson: string,
  identity: string
) {
  const { artifact, artifactJson } = yield* loadArtifact(
    change.artifactHash,
    identity
  );
  const projection = yield* parseStoredJson(
    projectionJson,
    "Content projection"
  );
  const state = yield* Schema.decodeUnknownEffect(RollbackUpsertStateSchema)(
    { artifact, change, projection },
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Rollback state ${identity} is inconsistent.`,
        })
    )
  );
  return upsertWritten(state, artifactJson);
});
/** Proves a stored upsert state matches its immutable content version. */
const validateVersion = Effect.fn("contentRelease.validateRollbackVersion")(
  function* (
    head: Docs["contentHeads"],
    state: RollbackUpsertState,
    identity: string
  ) {
    const projectionHash = yield* hashText(
      canonicalizeContentProjection(state.projection)
    );
    if (
      head.operation !== "upsert" ||
      head.family !== state.change.family ||
      head.artifactHash !== state.change.artifactHash ||
      head.compilerConfigHash !== state.artifact.payload.compilerConfigHash ||
      head.delivery !== state.change.delivery ||
      head.projectionHash !== projectionHash ||
      head.rendererDomain !== state.change.rendererDomain ||
      head.sourceHash !== state.artifact.payload.sourceHash ||
      head.sourcePath !== state.change.sourcePath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback state ${identity} does not match its immutable version.`
      );
    }
  }
);
/** Reconstructs the exact state produced by one completed release item. */
const currentState = Effect.fn("contentRelease.currentRollbackState")(
  function* (row: Docs["contentItems"]) {
    const item = yield* decodeItemJson(row.itemJson);
    if (item.change.operation === "delete") {
      return deleteWritten(item.change);
    }
    if (!row.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback source ${row.releaseId}/${row.index} lost its projection.`
      );
    }
    const head = yield* loadExactVersion(
      row.contentKey,
      row.artifactLocale,
      row.sequence
    );
    if (!head || head.releaseId !== row.releaseId || head.index !== row.index) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback source ${row.releaseId}/${row.index} lost its version.`
      );
    }
    const identity = `${row.releaseId}/${row.index}/current`;
    const written = yield* upsertState(
      item.change,
      row.projectionJson,
      identity
    );
    yield* validateVersion(head, written.state, identity);
    return written;
  }
);
/** Reconstructs the exact immutable state replaced by one release item. */
const priorState = Effect.fn("contentRelease.priorRollbackState")(function* (
  row: Docs["contentItems"]
) {
  const snapshot = yield* decodeRollbackJson(row.rollbackJson);
  const item = yield* decodeItemJson(row.itemJson);
  const priorIdentity =
    snapshot.snapshot.state === "absent"
      ? snapshot.snapshot
      : snapshot.snapshot.head;
  if (
    snapshot.index !== row.index ||
    snapshot.releaseId !== row.releaseId ||
    priorIdentity.contentKey !== item.change.contentKey ||
    priorIdentity.family !== item.change.family ||
    priorIdentity.artifactLocale !== item.change.artifactLocale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback snapshot ${row.releaseId}/${row.index} lost its identity.`
    );
  }
  if (snapshot.snapshot.state === "absent") {
    return deleteWritten({
      contentKey: snapshot.snapshot.contentKey,
      family: snapshot.snapshot.family,
      artifactLocale: snapshot.snapshot.artifactLocale,
      operation: "delete",
    });
  }
  if (row.priorSequence === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback source ${row.releaseId}/${row.index} lost its prior sequence.`
    );
  }
  const head = yield* loadExactVersion(
    row.contentKey,
    row.artifactLocale,
    row.priorSequence
  );
  if (head?.operation !== "upsert" || !head.projectionJson) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback source ${row.releaseId}/${row.index} lost its prior version.`
    );
  }
  const prior = snapshot.snapshot.head;
  const change = ContentUpsertSchema.make({
    artifactHash: prior.artifactHash,
    artifactLocale: prior.artifactLocale,
    contentKey: prior.contentKey,
    delivery: prior.delivery,
    family: prior.family,
    operation: "upsert",
    rendererDomain: prior.rendererDomain,
    sourcePath: prior.sourcePath,
  });
  const identity = `${row.releaseId}/${row.index}/prior`;
  const written = yield* upsertState(change, head.projectionJson, identity);
  yield* validateVersion(head, written.state, identity);
  if (
    prior.compilerConfigHash !== head.compilerConfigHash ||
    prior.projectionHash !== head.projectionHash ||
    prior.sourceHash !== head.sourceHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback source ${row.releaseId}/${row.index} disagrees with its snapshot.`
    );
  }
  return written;
});
/**
 * Builds one exact current-to-prior transition from immutable stored state, with the canonical
 * text of its page entry. The text equals canonicalizeRollbackRecord of the returned record.
 */
export const rollbackRecord = Effect.fn("contentRelease.rollbackRecord")(
  function* (row: Docs["contentItems"]) {
    // Both states are already schema-decoded and index shares the stored item
    // schema, so the transition needs no second decode.
    const current = yield* currentState(row);
    const prior = yield* priorState(row);
    return {
      record: {
        current: current.state,
        index: row.index,
        prior: prior.state,
      } satisfies RollbackRecord,
      text: `{"current":${current.text},"index":${row.index},"prior":${prior.text}}`,
    };
  }
);
