import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_BASELINE_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { hasMaterialReadModel } from "@repo/backend/convex/contentRelease/material/state";
import {
  deleteMaterial,
  writeMaterial,
} from "@repo/backend/convex/contentRelease/material/write";
import { loadReleaseItems } from "@repo/backend/convex/contentRelease/model";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { loadSyncRelease } from "@repo/backend/convex/contentRelease/sync";
import { Effect } from "effect";

/** Synchronizes one exact identity into the active material read model. */
const syncMaterialIdentity = Effect.fn("contentRelease.syncMaterialIdentity")(
  function* (
    ctx: MutationCtx,
    contentKey: string,
    artifactLocale: Doc<"contentKeys">["artifactLocale"],
    activeSequence: number
  ) {
    const resolved = yield* resolvePublicProjection(
      ctx,
      contentKey,
      artifactLocale,
      activeSequence
    );
    if (resolved?.family !== "material") {
      return yield* deleteMaterial(ctx, contentKey, artifactLocale);
    }
    const projection = yield* decodeProjectionJson(resolved.projectionJson);
    if (projection.kind !== "subject-lesson") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active material head ${contentKey}/${artifactLocale} is incomplete.`
      );
    }
    yield* writeMaterial(ctx, resolved, projection);
  }
);

/** Builds one bounded first material baseline from permanent identities. */
const baselineMaterials = Effect.fn("contentRelease.baselineMaterials")(
  function* (
    ctx: MutationCtx,
    cursor: string | undefined,
    active: Pick<Doc<"contentReleases">, "releaseId" | "sequence">
  ) {
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("contentKeys")
        .withIndex("by_family_and_contentKey_and_artifactLocale", (index) =>
          index.eq("family", "material")
        )
        .paginate({
          cursor: cursor ?? null,
          maximumBytesRead: MATERIAL_BASELINE_LIMIT * READ_MODEL_DOCUMENT_LIMIT,
          maximumRowsRead: MATERIAL_BASELINE_LIMIT,
          numItems: MATERIAL_BASELINE_LIMIT,
        })
    );
    for (const key of stored.page) {
      yield* syncMaterialIdentity(
        ctx,
        key.contentKey,
        key.artifactLocale,
        active.sequence
      );
    }
    return {
      cursor: stored.isDone ? undefined : stored.continueCursor,
      done: stored.isDone,
      processed: stored.page.length,
    };
  }
);

/** Checks whether one optional identity triplet is complete. */
function hasCompleteIdentity(fields: readonly unknown[]) {
  return fields.every((field) => field !== undefined);
}

/** Rejects one partially persisted read-model identity. */
const requireCompleteIdentity = Effect.fn(
  "contentRelease.requireCompleteMaterialIdentity"
)(function* (name: string, fields: readonly unknown[]) {
  if (
    !hasCompleteIdentity(fields) &&
    fields.some((field) => field !== undefined)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `${name} read-model ownership is partial.`
    );
  }
});

/** Advances the active material model through one durable release page. */
export const syncMaterials = Effect.fn("contentRelease.syncMaterials")(
  function* (ctx: MutationCtx, releaseId: string) {
    const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
    if (
      hasMaterialReadModel({
        manifestHash: signed.manifestHash,
        releaseId,
        sequence: release.sequence,
        state,
      })
    ) {
      return {
        done: true,
        nextIndex: release.materialIndex ?? signed.manifest.itemCount - 1,
        processed: 0,
      };
    }
    const materialIdentity = [
      state.materialManifestHash,
      state.materialReleaseId,
      state.materialSequence,
    ];
    yield* requireCompleteIdentity("Material", materialIdentity);
    const hasMaterialBaseline = hasCompleteIdentity(materialIdentity);
    const needsBaseline = !hasMaterialBaseline;
    let cursor: string | undefined;
    let done: boolean;
    let nextIndex = release.materialIndex ?? -1;
    let processed: number;
    if (needsBaseline) {
      const baseline = yield* baselineMaterials(
        ctx,
        release.materialCursor,
        release
      );
      cursor = baseline.cursor;
      done = baseline.done;
      processed = baseline.processed;
      if (done) {
        nextIndex = signed.manifest.itemCount - 1;
      }
    } else {
      const afterIndex = release.materialIndex ?? -1;
      const page = yield* loadReleaseItems(ctx, releaseId, afterIndex);
      for (const [offset, row] of page.page.entries()) {
        if (row.index !== afterIndex + offset + 1) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Material sync ${releaseId} lost contiguous item ${afterIndex + offset + 1}.`
          );
        }
        yield* syncMaterialIdentity(
          ctx,
          row.contentKey,
          row.artifactLocale,
          release.sequence
        );
      }
      nextIndex = page.page.at(-1)?.index ?? afterIndex;
      done = page.isDone;
      processed = page.page.length;
      if (done && nextIndex !== signed.manifest.itemCount - 1) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Material sync ${releaseId} stopped at item ${nextIndex}.`
        );
      }
    }
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        materialCursor: cursor,
        materialIndex: nextIndex,
        ...(done ? { materialSyncedAt: now } : {}),
        updatedAt: now,
      })
    );
    if (done) {
      yield* Effect.promise(() =>
        ctx.db.patch("contentState", state._id, {
          materialManifestHash: signed.manifestHash,
          materialReleaseId: releaseId,
          materialSequence: release.sequence,
          updatedAt: now,
        })
      );
    }
    return { done, nextIndex, processed };
  }
);
