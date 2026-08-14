import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadReleaseItems,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeArtifactJson,
  decodeItemJson,
  decodeProjectionJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  deleteSearchEntry,
  writeSearchEntry,
} from "@repo/backend/convex/contentRelease/search/write";
import { loadSyncRelease } from "@repo/backend/convex/contentRelease/sync";
import { Effect } from "effect";

/** Loads the signed artifact selected by one active public projection. */
const loadSearchArtifact = Effect.fn("contentRelease.loadSearchArtifact")(
  function* (
    ctx: MutationCtx,
    head: Doc<"contentHeads">,
    artifactHash: string
  ) {
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", artifactHash)
        )
        .unique()
    );
    if (!row) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Active search artifact ${artifactHash} does not exist.`
      );
    }
    const artifact = yield* decodeArtifactJson(row.artifactJson);
    if (
      artifact.artifactHash !== artifactHash ||
      artifact.payload.contentKey !== head.contentKey ||
      artifact.payload.artifactLocale !== head.artifactLocale
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active search artifact ${artifactHash} changed identity.`
      );
    }
    return artifact;
  }
);

/** Synchronizes one changed identity into the active-only search model. */
const syncSearchItem = Effect.fn("contentRelease.syncSearchItem")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">,
  activeSequence: number
) {
  const projection = yield* resolvePublicProjection(
    ctx,
    row.contentKey,
    row.artifactLocale,
    activeSequence
  );
  if (!projection) {
    const item = yield* decodeItemJson(row.itemJson);
    if (
      item.change.contentKey !== row.contentKey ||
      item.change.artifactLocale !== row.artifactLocale
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Search item ${row.releaseId}/${row.index} lost its signed identity.`
      );
    }
    if (item.change.family === "question") {
      return;
    }
    return yield* deleteSearchEntry(ctx, row.contentKey, row.artifactLocale);
  }
  const head = yield* loadVersion(
    ctx,
    row.contentKey,
    row.artifactLocale,
    activeSequence
  );
  if (
    head?.operation !== "upsert" ||
    !head.artifactHash ||
    head.projectionJson !== projection.projectionJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active search head ${row.contentKey}/${row.artifactLocale} is incomplete.`
    );
  }
  const [artifact, decoded] = yield* Effect.all([
    loadSearchArtifact(ctx, head, head.artifactHash),
    decodeProjectionJson(projection.projectionJson),
  ]);
  yield* writeSearchEntry(ctx, head, decoded, artifact.payload.plainText);
});

/** Advances the active-only search model through one durable release page. */
export const syncSearch = Effect.fn("contentRelease.syncSearch")(function* (
  ctx: MutationCtx,
  releaseId: string
) {
  const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
  if (
    state.searchManifestHash === signed.manifestHash &&
    state.searchReleaseId === releaseId &&
    state.searchSequence === release.sequence
  ) {
    return {
      done: true,
      nextIndex: release.searchIndex ?? signed.manifest.itemCount - 1,
      processed: 0,
    };
  }
  const afterIndex = release.searchIndex ?? -1;
  const page = yield* loadReleaseItems(ctx, releaseId, afterIndex);
  for (const [offset, row] of page.page.entries()) {
    if (row.index !== afterIndex + offset + 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Search sync ${releaseId} lost contiguous item ${afterIndex + offset + 1}.`
      );
    }
    yield* syncSearchItem(ctx, row, release.sequence);
  }
  const nextIndex = page.page.at(-1)?.index ?? afterIndex;
  const done = page.isDone;
  if (done && nextIndex !== signed.manifest.itemCount - 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Search sync ${releaseId} stopped at item ${nextIndex}.`
    );
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      searchIndex: nextIndex,
      ...(done ? { searchSyncedAt: now } : {}),
      updatedAt: now,
    })
  );
  if (done) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        searchManifestHash: signed.manifestHash,
        searchReleaseId: releaseId,
        searchSequence: release.sequence,
        updatedAt: now,
      })
    );
  }
  return { done, nextIndex, processed: page.page.length };
});
