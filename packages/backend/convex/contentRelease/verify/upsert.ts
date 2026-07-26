import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadExactVersion,
  loadRouteBinding,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeArtifactJson,
  decodeItemJson,
  decodeProjectionWireJson,
} from "@repo/backend/convex/contentRelease/parse";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

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
  const projection = yield* decodeProjectionWireJson(row.projectionJson);
  const projectionHash = yield* hashText(
    "the content projection",
    canonicalizeContentProjection(projection)
  );
  const binding =
    projection.kind === "question-body"
      ? null
      : yield* loadRouteBinding(
          ctx,
          row.locale,
          projection.publicPath,
          row.sequence
        );
  const hasExpectedRoute =
    projection.kind === "question-body"
      ? binding === null
      : binding?.operation === "bind" &&
        binding.contentKey === row.contentKey &&
        !(
          binding.sequence === row.sequence &&
          binding.releaseId !== row.releaseId
        );
  if (
    artifact.artifactHash !== change.artifactHash ||
    artifact.payload.contentKey !== row.contentKey ||
    artifact.payload.locale !== row.locale ||
    artifact.payload.rendererDomain !== change.rendererDomain ||
    familyForProjection(projection) !== change.family ||
    projection.contentKey !== row.contentKey ||
    projection.locale !== row.locale ||
    !hasExpectedRoute
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Upsert ${row.releaseId}/${row.index} has mismatched staged evidence.`
    );
  }
  return {
    artifactHash: change.artifactHash,
    compilerConfigHash: artifact.payload.compilerConfigHash,
    contentKey: row.contentKey,
    delivery: change.delivery,
    family: change.family,
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
  } satisfies WithoutSystemFields<Doc<"contentHeads">>;
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
export const writeUpsert = Effect.fn("contentRelease.writeUpsert")(function* (
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
  } else {
    yield* ensureDocumentSize(
      "Immutable content head",
      version,
      READ_MODEL_DOCUMENT_LIMIT
    );
    yield* Effect.promise(() => ctx.db.insert("contentHeads", version));
  }
});
