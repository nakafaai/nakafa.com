import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeArtifactJson,
  decodeProjectionJson,
  decodeReleaseJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  deleteSearchEntry,
  writeSearchEntry,
} from "@repo/backend/convex/contentRelease/search/write";
import {
  COMPACTION_PAGE_BYTES,
  RELEASE_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const searchSyncValidator = v.object({
  complete: v.boolean(),
  processed: v.number(),
});

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
      artifact.payload.locale !== head.locale
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
    row.locale,
    activeSequence
  );
  if (!projection) {
    return yield* deleteSearchEntry(ctx, row.contentKey, row.locale);
  }
  const head = yield* loadVersion(
    ctx,
    row.contentKey,
    row.locale,
    activeSequence
  );
  if (
    head?.operation !== "upsert" ||
    !head.artifactHash ||
    head.projectionJson !== projection.projectionJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active search head ${row.contentKey}/${row.locale} is incomplete.`
    );
  }
  const [artifact, decoded] = yield* Effect.all([
    loadSearchArtifact(ctx, head, head.artifactHash),
    decodeProjectionJson(projection.projectionJson),
  ]);
  yield* writeSearchEntry(ctx, head, decoded, artifact.payload.plainText);
});

/** Loads one byte- and row-bounded page of changed release identities. */
const loadSearchItems = Effect.fn("contentRelease.loadSearchItems")(function* (
  ctx: MutationCtx,
  releaseId: string,
  afterIndex: number
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_index", (index) =>
        index.eq("releaseId", releaseId).gt("index", afterIndex)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: COMPACTION_PAGE_BYTES,
        maximumRowsRead: RELEASE_PAGE_LIMIT,
        numItems: RELEASE_PAGE_LIMIT,
      })
  );
});

/** Advances the active-only search model through one durable release page. */
export const syncSearch = Effect.fn("contentRelease.syncSearch")(function* (
  ctx: MutationCtx,
  releaseId: string
) {
  const [release, state] = yield* Effect.all([
    loadRelease(ctx, releaseId),
    loadState(ctx),
  ]);
  if (
    !state ||
    release.status !== "completed" ||
    state.activeReleaseId !== releaseId ||
    state.activeSequence !== release.sequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Search sync ${releaseId} is not the active completed release.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (
    signed.manifestHash !== state.activeManifestHash ||
    signed.manifest.itemCount < 0
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Search sync ${releaseId} lost its active manifest.`
    );
  }
  if (
    state.searchManifestHash === signed.manifestHash &&
    state.searchReleaseId === releaseId &&
    state.searchSequence === release.sequence
  ) {
    return { complete: true, processed: 0 };
  }
  const afterIndex = release.searchIndex ?? -1;
  const page = yield* loadSearchItems(ctx, releaseId, afterIndex);
  for (const [offset, row] of page.page.entries()) {
    if (row.index !== afterIndex + offset + 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Search sync ${releaseId} lost contiguous item ${afterIndex + offset + 1}.`
      );
    }
    yield* syncSearchItem(ctx, row, release.sequence);
  }
  const lastIndex = page.page.at(-1)?.index ?? afterIndex;
  const complete = page.isDone;
  if (complete && lastIndex !== signed.manifest.itemCount - 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Search sync ${releaseId} stopped at item ${lastIndex}.`
    );
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      searchIndex: lastIndex,
      ...(complete ? { searchSyncedAt: now } : {}),
      updatedAt: now,
    })
  );
  if (complete) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        searchManifestHash: signed.manifestHash,
        searchReleaseId: releaseId,
        searchSequence: release.sequence,
        updatedAt: now,
      })
    );
  }
  return { complete, processed: page.page.length };
});

/** Internal bounded step resumed by the authenticated activation action. */
export const sync = internalMutation({
  args: { releaseId: v.string() },
  returns: searchSyncValidator,
  handler: (ctx, { releaseId }) => runConvexProgram(syncSearch(ctx, releaseId)),
});
