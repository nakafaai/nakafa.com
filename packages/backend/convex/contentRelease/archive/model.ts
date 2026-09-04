import {
  CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
  type ContentRuntimeArchiveIdentity,
} from "@repo/backend/content/archive";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

type ReadCtx = QueryCtx | MutationCtx;

interface StoredArchiveMetadata {
  readonly contentType?: string;
  readonly sha256: string;
  readonly size: number;
}

/** Loads one exact immutable archive identity. */
export function loadArchive(
  ctx: ReadCtx,
  identity: ContentRuntimeArchiveIdentity
) {
  return ctx.db
    .query("contentRuntimeArchives")
    .withIndex("by_contentStateHash_and_runtimeSchemaFingerprint", (query) =>
      query
        .eq("contentStateHash", identity.contentStateHash)
        .eq("runtimeSchemaFingerprint", identity.runtimeSchemaFingerprint)
    )
    .unique();
}

/** Loads the single producer lease for one archive identity. */
export function loadClaim(
  ctx: ReadCtx,
  identity: ContentRuntimeArchiveIdentity
) {
  return ctx.db
    .query("contentRuntimeArchiveClaims")
    .withIndex("by_contentStateHash_and_runtimeSchemaFingerprint", (query) =>
      query
        .eq("contentStateHash", identity.contentStateHash)
        .eq("runtimeSchemaFingerprint", identity.runtimeSchemaFingerprint)
    )
    .unique();
}

/** Projects storage-private state into authenticated transport metadata. */
export function archiveMetadata(archive: Doc<"contentRuntimeArchives">) {
  return {
    archiveSha256: archive.archiveSha256,
    byteLength: archive.byteLength,
    contentStateHash: archive.contentStateHash,
    createdAt: archive.createdAt,
    runtimeSchemaFingerprint: archive.runtimeSchemaFingerprint,
  };
}

/** Proves that canonical row metadata still names the exact stored bytes. */
export function matchesArchiveStorage(
  archive: Doc<"contentRuntimeArchives">,
  stored: StoredArchiveMetadata | null
) {
  return (
    stored?.contentType === CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE &&
    stored.sha256 === archive.archiveSha256 &&
    stored.size === archive.byteLength
  );
}

/** Deletes only an unreferenced blob owned by the runtime archive protocol. */
export const deleteUnreferencedArchiveStorage = Effect.fn(
  "contentRuntimeArchive.deleteStorage"
)(function* (ctx: MutationCtx, storageId: Id<"_storage">) {
  const stored = yield* Effect.promise(() =>
    ctx.db.system.get("_storage", storageId)
  );
  if (stored?.contentType !== CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE) {
    return false;
  }
  const canonical = yield* Effect.promise(() =>
    ctx.db
      .query("contentRuntimeArchives")
      .withIndex("by_storageId", (query) => query.eq("storageId", storageId))
      .first()
  );
  if (canonical) {
    return false;
  }
  yield* Effect.promise(() => ctx.storage.delete(storageId));
  return true;
});
