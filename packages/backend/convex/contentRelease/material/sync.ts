import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_BASELINE_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import {
  deleteMaterial,
  writeMaterial,
} from "@repo/backend/convex/contentRelease/material/write";
import { loadReleaseItems } from "@repo/backend/convex/contentRelease/model";
import { decodeProjectionWireJson } from "@repo/backend/convex/contentRelease/parse";
import { progressValidator } from "@repo/backend/convex/contentRelease/spec";
import { loadSyncRelease } from "@repo/backend/convex/contentRelease/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

type ModelProgress = Infer<typeof progressValidator>;

const resumeReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  ModelProgress
>("contentRelease/material/sync:resume");

/** Synchronizes one exact identity into the active material read model. */
const syncMaterialIdentity = Effect.fn("contentRelease.syncMaterialIdentity")(
  function* (
    ctx: MutationCtx,
    contentKey: string,
    locale: Doc<"contentKeys">["locale"],
    activeSequence: number
  ) {
    const resolved = yield* resolvePublicProjection(
      ctx,
      contentKey,
      locale,
      activeSequence
    );
    if (resolved?.family !== "material") {
      return yield* deleteMaterial(ctx, contentKey, locale);
    }
    const projection = yield* decodeProjectionWireJson(resolved.projectionJson);
    if (projection.kind !== "subject-lesson") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active material head ${contentKey}/${locale} is incomplete.`
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
    activeSequence: number
  ) {
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("contentKeys")
        .withIndex("by_family_and_contentKey_and_locale", (index) =>
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
        key.locale,
        activeSequence
      );
    }
    return {
      cursor: stored.isDone ? undefined : stored.continueCursor,
      done: stored.isDone,
      processed: stored.page.length,
    };
  }
);

/** Advances the active material model through one durable release page. */
export const syncMaterials = Effect.fn("contentRelease.syncMaterials")(
  function* (ctx: MutationCtx, releaseId: string) {
    const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
    if (
      state.materialManifestHash === signed.manifestHash &&
      state.materialReleaseId === releaseId &&
      state.materialSequence === release.sequence
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
    const hasBaseline = materialIdentity.every((field) => field !== undefined);
    if (!hasBaseline && materialIdentity.some((field) => field !== undefined)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Material read-model ownership is partial."
      );
    }
    let cursor: string | undefined;
    let done: boolean;
    let nextIndex = release.materialIndex ?? -1;
    let processed: number;
    if (hasBaseline) {
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
          row.locale,
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
    } else {
      const baseline = yield* baselineMaterials(
        ctx,
        release.materialCursor,
        release.sequence
      );
      cursor = baseline.cursor;
      done = baseline.done;
      processed = baseline.processed;
      if (done) {
        nextIndex = signed.manifest.itemCount - 1;
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

/** Runs one bounded material-model page for the lifecycle action. */
export const page = internalMutation({
  args: { releaseId: v.string() },
  returns: progressValidator,
  handler: (ctx, { releaseId }) =>
    runConvexProgram(syncMaterials(ctx, releaseId)),
});

/** Durably resumes material indexing until the active release is complete. */
export const resume = internalMutation({
  args: { releaseId: v.string() },
  returns: progressValidator,
  handler: (ctx, { releaseId }) =>
    runConvexProgram(
      Effect.gen(function* () {
        const result = yield* syncMaterials(ctx, releaseId);
        if (!result.done) {
          yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, resumeReference, { releaseId })
          );
        }
        return result;
      })
    ),
});
