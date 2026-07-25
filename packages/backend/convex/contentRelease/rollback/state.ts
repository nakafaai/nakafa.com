import { canonicalizeContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import {
  type ContentChange,
  ContentUpsertSchema,
} from "@nakafa/aksara-contracts/release";
import {
  RollbackRecordSchema,
  type RollbackState,
  RollbackUpsertStateSchema,
} from "@nakafa/aksara-contracts/release/rollback";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { loadExactVersion } from "@repo/backend/convex/contentRelease/model";
import {
  decodeArtifactJson,
  decodeItemJson,
  decodeProjectionJson,
  decodeRollbackJson,
} from "@repo/backend/convex/contentRelease/parse";
import { Effect, Schema } from "effect";

type UpsertChange = Extract<ContentChange, { readonly operation: "upsert" }>;

/** Loads one immutable signed artifact required by a rollback state. */
const loadArtifact = Effect.fn("contentRelease.loadRollbackArtifact")(
  function* (ctx: QueryCtx, artifactHash: string, identity: string) {
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (query) =>
          query.eq("artifactHash", artifactHash)
        )
        .unique()
    );
    if (!stored) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Rollback state ${identity} lost artifact ${artifactHash}.`
      );
    }
    return yield* decodeArtifactJson(stored.artifactJson);
  }
);

/** Builds and validates one complete body-bearing rollback state. */
const upsertState = Effect.fn("contentRelease.rollbackUpsertState")(function* (
  ctx: QueryCtx,
  change: UpsertChange,
  projectionJson: string,
  identity: string
) {
  const state = {
    artifact: yield* loadArtifact(ctx, change.artifactHash, identity),
    change,
    projection: yield* decodeProjectionJson(projectionJson),
  };
  return yield* Schema.decodeUnknown(RollbackUpsertStateSchema)(state, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Rollback state ${identity} is inconsistent.`,
        })
    )
  );
});

/** Proves a stored upsert state matches its immutable content version. */
const validateVersion = Effect.fn("contentRelease.validateRollbackVersion")(
  function* (
    head: Doc<"contentHeads">,
    state: typeof RollbackUpsertStateSchema.Type,
    identity: string
  ) {
    const projectionHash = yield* hashText(
      "the rollback content projection",
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
  function* (ctx: QueryCtx, row: Doc<"contentItems">) {
    const item = yield* decodeItemJson(row.itemJson);
    if (item.change.operation === "delete") {
      return { change: item.change } satisfies RollbackState;
    }
    if (!row.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback source ${row.releaseId}/${row.index} lost its projection.`
      );
    }
    const head = yield* loadExactVersion(
      ctx,
      row.contentKey,
      row.locale,
      row.sequence
    );
    if (!head || head.releaseId !== row.releaseId || head.index !== row.index) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback source ${row.releaseId}/${row.index} lost its version.`
      );
    }
    const state = yield* upsertState(
      ctx,
      item.change,
      row.projectionJson,
      `${row.releaseId}/${row.index}/current`
    );
    yield* validateVersion(
      head,
      state,
      `${row.releaseId}/${row.index}/current`
    );
    return state;
  }
);

/** Reconstructs the exact immutable state replaced by one release item. */
const priorState = Effect.fn("contentRelease.priorRollbackState")(function* (
  ctx: QueryCtx,
  row: Doc<"contentItems">
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
    priorIdentity.locale !== item.change.locale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback snapshot ${row.releaseId}/${row.index} lost its identity.`
    );
  }
  if (snapshot.snapshot.state === "absent") {
    return {
      change: {
        contentKey: snapshot.snapshot.contentKey,
        family: snapshot.snapshot.family,
        locale: snapshot.snapshot.locale,
        operation: "delete",
      },
    } satisfies RollbackState;
  }
  if (row.priorSequence === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback source ${row.releaseId}/${row.index} lost its prior sequence.`
    );
  }
  const head = yield* loadExactVersion(
    ctx,
    row.contentKey,
    row.locale,
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
    contentKey: prior.contentKey,
    delivery: prior.delivery,
    family: prior.family,
    locale: prior.locale,
    operation: "upsert",
    rendererDomain: prior.rendererDomain,
    sourcePath: prior.sourcePath,
  });
  const state = yield* upsertState(
    ctx,
    change,
    head.projectionJson,
    `${row.releaseId}/${row.index}/prior`
  );
  yield* validateVersion(head, state, `${row.releaseId}/${row.index}/prior`);
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
  return state;
});

/** Builds one exact current-to-prior transition from immutable stored state. */
export const rollbackRecord = Effect.fn("contentRelease.rollbackRecord")(
  function* (ctx: QueryCtx, row: Doc<"contentItems">) {
    return yield* Schema.decodeUnknown(RollbackRecordSchema)(
      {
        current: yield* currentState(ctx, row),
        index: row.index,
        prior: yield* priorState(ctx, row),
      },
      { onExcessProperty: "error" }
    ).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Rollback transition ${row.releaseId}/${row.index} is inconsistent.`,
          })
      )
    );
  }
);
