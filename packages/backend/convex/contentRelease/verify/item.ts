import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { canonicalizeMaterialHead } from "@nakafa/aksara-contracts/release/head";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolveMaterialHead } from "@repo/backend/convex/contentRelease/catalog";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  ensureDocumentSize,
  HEAD_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadExactVersion,
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeArtifactJson,
  decodeItemJson,
  decodeProjectionJson,
  decodeRollbackJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

/** Confirms stored prior evidence matches the immutable base snapshot. */
const checkRollback = Effect.fn("contentRelease.checkRollback")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">
) {
  const snapshot = yield* decodeRollbackJson(row.rollbackJson);
  if (snapshot.index !== row.index || snapshot.releaseId !== row.releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback evidence ${row.releaseId}/${row.index} lost its identity.`
    );
  }
  const prior =
    row.priorSequence === undefined
      ? null
      : yield* loadVersion(ctx, row.contentKey, row.locale, row.priorSequence);
  if (!prior || prior.operation === "delete") {
    if (
      snapshot.snapshot.state !== "absent" ||
      snapshot.snapshot.contentKey !== row.contentKey ||
      snapshot.snapshot.locale !== row.locale
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback evidence ${row.releaseId}/${row.index} contradicts absence.`
      );
    }
    return;
  }
  const head = yield* resolveMaterialHead(
    ctx,
    row.contentKey,
    row.locale,
    row.priorSequence ?? prior.sequence
  );
  if (
    !head ||
    snapshot.snapshot.state !== "material" ||
    canonicalizeMaterialHead(head) !==
      canonicalizeMaterialHead(snapshot.snapshot.head)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback evidence ${row.releaseId}/${row.index} differs from its base.`
    );
  }
});

/** Rejects a delete whose content identity still owns a visible route. */
const checkDeletedRoute = Effect.fn("contentRelease.checkDeletedRoute")(
  function* (ctx: MutationCtx, row: Doc<"contentItems">) {
    if (row.priorSequence === undefined) {
      return;
    }
    const prior = yield* loadVersion(
      ctx,
      row.contentKey,
      row.locale,
      row.priorSequence
    );
    if (!prior?.projectionJson || prior.operation === "delete") {
      return;
    }
    const projection = yield* decodeProjectionJson(prior.projectionJson);
    const owner = yield* Effect.promise(() =>
      ctx.db
        .query("contentBindings")
        .withIndex("by_locale_and_publicPath_and_sequence_and_index", (query) =>
          query
            .eq("locale", row.locale)
            .eq("publicPath", projection.publicPath)
            .lte("sequence", row.sequence)
        )
        .order("desc")
        .first()
    );
    if (
      !owner ||
      owner.operation === "delete" ||
      owner.contentKey !== row.contentKey
    ) {
      return;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_ROUTE",
      `Deleted content ${row.contentKey}/${row.locale} still owns a route.`
    );
  }
);

/** Inserts one immutable delete version or validates its idempotent retry. */
const writeDelete = Effect.fn("contentRelease.writeDelete")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">
) {
  const existing = yield* loadExactVersion(
    ctx,
    row.contentKey,
    row.locale,
    row.sequence
  );
  if (existing) {
    if (
      existing.operation !== "delete" ||
      existing.releaseId !== row.releaseId ||
      existing.index !== row.index
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content version ${row.contentKey}/${row.locale}/${row.sequence} conflicts.`
      );
    }
    return;
  }
  yield* checkDeletedRoute(ctx, row);
  yield* Effect.promise(() =>
    ctx.db.insert("contentHeads", {
      contentKey: row.contentKey,
      family: "material",
      index: row.index,
      locale: row.locale,
      operation: "delete",
      releaseId: row.releaseId,
      sequence: row.sequence,
    })
  );
});

/** Builds the complete immutable upsert version from staged evidence. */
const upsertVersion = Effect.fn("contentRelease.upsertVersion")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">
) {
  if (!(row.artifactReady && row.projectionReady && row.projectionJson)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Upsert ${row.releaseId}/${row.index} is missing staged bodies.`
    );
  }
  const item = yield* decodeItemJson(row.itemJson);
  if (item.change.operation !== "upsert") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release item ${row.releaseId}/${row.index} changed operation.`
    );
  }
  const change = item.change;
  const artifactRow = yield* Effect.promise(() =>
    ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (query) =>
        query.eq("artifactHash", change.artifactHash)
      )
      .unique()
  );
  if (!artifactRow) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Artifact for ${row.releaseId}/${row.index} is missing.`
    );
  }
  const artifact = yield* decodeArtifactJson(artifactRow.artifactJson);
  const projection = yield* decodeProjectionJson(row.projectionJson);
  const projectionHash = yield* hashText(
    "the material projection",
    canonicalizeMaterialProjection(projection)
  );
  const binding = yield* loadRouteBinding(
    ctx,
    row.locale,
    projection.publicPath,
    row.sequence
  );
  if (
    artifact.artifactHash !== change.artifactHash ||
    artifact.payload.contentKey !== row.contentKey ||
    artifact.payload.locale !== row.locale ||
    artifact.payload.rendererDomain !== change.rendererDomain ||
    projection.contentKey !== row.contentKey ||
    projection.locale !== row.locale ||
    binding?.operation !== "bind" ||
    binding.contentKey !== row.contentKey ||
    (binding.sequence === row.sequence && binding.releaseId !== row.releaseId)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Upsert ${row.releaseId}/${row.index} has mismatched staged evidence.`
    );
  }
  const version: WithoutSystemFields<Doc<"contentHeads">> = {
    artifactHash: change.artifactHash,
    compilerConfigHash: artifact.payload.compilerConfigHash,
    contentKey: row.contentKey,
    delivery: change.delivery,
    family: "material",
    index: row.index,
    locale: row.locale,
    operation: "upsert",
    projectionHash,
    projectionJson: row.projectionJson,
    releaseId: row.releaseId,
    rendererDomain: change.rendererDomain,
    sequence: row.sequence,
    sourceHash: artifact.payload.sourceHash,
    sourcePath: change.sourcePath,
  };
  return version;
});

/** Compares every persisted immutable head field without system metadata. */
function sameVersion(
  stored: Doc<"contentHeads">,
  expected: Omit<Doc<"contentHeads">, "_creationTime" | "_id">
) {
  return (
    stored.artifactHash === expected.artifactHash &&
    stored.compilerConfigHash === expected.compilerConfigHash &&
    stored.contentKey === expected.contentKey &&
    stored.delivery === expected.delivery &&
    stored.family === expected.family &&
    stored.index === expected.index &&
    stored.locale === expected.locale &&
    stored.operation === expected.operation &&
    stored.projectionHash === expected.projectionHash &&
    stored.projectionJson === expected.projectionJson &&
    stored.releaseId === expected.releaseId &&
    stored.rendererDomain === expected.rendererDomain &&
    stored.sequence === expected.sequence &&
    stored.sourceHash === expected.sourceHash &&
    stored.sourcePath === expected.sourcePath
  );
}

/** Inserts one immutable upsert version or validates its idempotent retry. */
const writeUpsert = Effect.fn("contentRelease.writeUpsert")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">
) {
  const version = yield* upsertVersion(ctx, row);
  const existing = yield* loadExactVersion(
    ctx,
    row.contentKey,
    row.locale,
    row.sequence
  );
  if (existing) {
    if (!sameVersion(existing, version)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content version ${row.contentKey}/${row.locale}/${row.sequence} conflicts.`
      );
    }
    return;
  }
  yield* ensureDocumentSize(
    "Immutable content head",
    version,
    HEAD_DOCUMENT_LIMIT
  );
  yield* Effect.promise(() => ctx.db.insert("contentHeads", version));
});

/** Verifies one staged item and writes its immutable sequence version. */
export const checkItem = Effect.fn("contentRelease.checkItem")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">
) {
  yield* checkRollback(ctx, row);
  const item = yield* decodeItemJson(row.itemJson);
  if (item.change.operation === "delete") {
    if (row.artifactReady || row.projectionReady || row.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Delete item ${row.releaseId}/${row.index} contains bodies.`
      );
    }
    return yield* writeDelete(ctx, row);
  }
  return yield* writeUpsert(ctx, row);
});
