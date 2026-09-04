import {
  CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
  CONTENT_RUNTIME_ARCHIVE_LEASE_MS,
  type ContentRuntimeArchiveClaim,
  type ContentRuntimeArchiveIdentity,
} from "@repo/backend/content/archive";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import {
  archiveMetadata,
  deleteUnreferencedArchiveStorage,
  loadArchive,
  loadClaim,
  matchesArchiveStorage,
} from "@repo/backend/convex/contentRelease/archive/model";
import { pruneArchives } from "@repo/backend/convex/contentRelease/archive/retention";
import {
  runtimeArchiveAbortResultValidator,
  runtimeArchiveClaimResultValidator,
  runtimeArchiveDownloadValidator,
  runtimeArchiveFinalizeResultValidator,
  runtimeArchiveIdentityValidator,
  runtimeArchiveReleaseResultValidator,
} from "@repo/backend/convex/contentRelease/archive/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

const claimArgs = {
  ...runtimeArchiveIdentityValidator,
  claimId: v.string(),
};

/** Acquires or renews one exclusive lease before an expensive export. */
const claimProgram = Effect.fn("contentRuntimeArchive.claim")(function* (
  ctx: MutationCtx,
  args: ContentRuntimeArchiveClaim
) {
  const existing = yield* Effect.promise(() => loadArchive(ctx, args));
  if (existing) {
    const stored = yield* Effect.promise(() =>
      ctx.db.system.get("_storage", existing.storageId)
    );
    if (matchesArchiveStorage(existing, stored)) {
      return { kind: "existing", metadata: archiveMetadata(existing) } as const;
    }
    yield* Effect.promise(() => ctx.db.delete(existing._id));
    yield* deleteUnreferencedArchiveStorage(ctx, existing.storageId);
  }

  const now = yield* Clock.currentTimeMillis;
  const expiresAt = now + CONTENT_RUNTIME_ARCHIVE_LEASE_MS;
  const current = yield* Effect.promise(() => loadClaim(ctx, args));
  if (current && current.claimId !== args.claimId && current.expiresAt > now) {
    return { expiresAt: current.expiresAt, kind: "busy" } as const;
  }
  if (current) {
    yield* Effect.promise(() =>
      ctx.db.patch(current._id, { claimId: args.claimId, expiresAt })
    );
  } else {
    yield* Effect.promise(() =>
      ctx.db.insert("contentRuntimeArchiveClaims", { ...args, expiresAt })
    );
  }
  return { expiresAt, kind: "claimed" } as const;
});

/** Releases a lease only when the exact claimant still owns it. */
const releaseProgram = Effect.fn("contentRuntimeArchive.release")(function* (
  ctx: MutationCtx,
  args: ContentRuntimeArchiveClaim
) {
  const claim = yield* Effect.promise(() => loadClaim(ctx, args));
  const released = claim?.claimId === args.claimId;
  if (released) {
    yield* Effect.promise(() => ctx.db.delete(claim._id));
  }
  return { released };
});

/** Confirms that an upload request still owns the unexpired producer lease. */
const ownsProgram = Effect.fn("contentRuntimeArchive.owns")(function* (
  ctx: MutationCtx,
  args: ContentRuntimeArchiveClaim
) {
  const claim = yield* Effect.promise(() => loadClaim(ctx, args));
  const now = yield* Clock.currentTimeMillis;
  return claim?.claimId === args.claimId && claim.expiresAt > now;
});

/** Commits one uploaded archive exactly once for its immutable identity. */
const finalizeProgram = Effect.fn("contentRuntimeArchive.finalize")(function* (
  ctx: MutationCtx,
  args: ContentRuntimeArchiveClaim & {
    readonly archiveSha256: string;
    readonly byteLength: number;
    readonly sourceStateHash: string;
    readonly storageId: string;
  }
) {
  const storageId = ctx.db.system.normalizeId("_storage", args.storageId);
  if (!storageId) {
    return { kind: "invalid" } as const;
  }

  let ownsStorage = false;
  const existing = yield* Effect.promise(() => loadArchive(ctx, args));
  if (existing) {
    const canonicalStorage = yield* Effect.promise(() =>
      ctx.db.system.get("_storage", existing.storageId)
    );
    if (matchesArchiveStorage(existing, canonicalStorage)) {
      if (
        existing.archiveSha256 !== args.archiveSha256 ||
        existing.byteLength !== args.byteLength
      ) {
        return { kind: "conflict" } as const;
      }
      return {
        kind: "unchanged",
        metadata: archiveMetadata(existing),
      } as const;
    }
    yield* Effect.promise(() => ctx.db.delete(existing._id));
    ownsStorage = existing.storageId === storageId;
    if (!ownsStorage) {
      yield* deleteUnreferencedArchiveStorage(ctx, existing.storageId);
    }
  }

  const now = yield* Clock.currentTimeMillis;
  const claim = yield* Effect.promise(() => loadClaim(ctx, args));
  if (!claim || claim.claimId !== args.claimId || claim.expiresAt <= now) {
    if (ownsStorage) {
      yield* deleteUnreferencedArchiveStorage(ctx, storageId);
    }
    return { kind: "conflict" } as const;
  }

  const canonical = yield* Effect.promise(() =>
    ctx.db
      .query("contentRuntimeArchives")
      .withIndex("by_storageId", (query) => query.eq("storageId", storageId))
      .first()
  );
  if (canonical) {
    yield* Effect.promise(() => ctx.db.delete(claim._id));
    return { kind: "conflict" } as const;
  }

  const stored = yield* Effect.promise(() =>
    ctx.db.system.get("_storage", storageId)
  );
  if (
    !stored ||
    stored.contentType !== CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE ||
    stored.sha256 !== args.archiveSha256 ||
    stored.size !== args.byteLength
  ) {
    if (ownsStorage) {
      yield* deleteUnreferencedArchiveStorage(ctx, storageId);
    }
    yield* Effect.promise(() => ctx.db.delete(claim._id));
    return { kind: "invalid" } as const;
  }

  const metadata = {
    archiveSha256: args.archiveSha256,
    byteLength: args.byteLength,
    createdAt: now,
    runtimeSelectionHash: args.runtimeSelectionHash,
    runtimeSchemaFingerprint: args.runtimeSchemaFingerprint,
    sourceStateHash: args.sourceStateHash,
  };
  yield* Effect.promise(() =>
    ctx.db.insert("contentRuntimeArchives", { ...metadata, storageId })
  );
  yield* Effect.promise(() => ctx.db.delete(claim._id));
  yield* pruneArchives(ctx, now);
  return { kind: "stored", metadata } as const;
});

/** Deletes proven stale storage and defers unproven uploads to the bounded sweep. */
const abortProgram = Effect.fn("contentRuntimeArchive.abort")(function* (
  ctx: MutationCtx,
  args: ContentRuntimeArchiveClaim & { readonly storageId: string }
) {
  const storageId = ctx.db.system.normalizeId("_storage", args.storageId);
  if (!storageId) {
    return { kind: "invalid" } as const;
  }
  let deleted = false;
  const existing = yield* Effect.promise(() => loadArchive(ctx, args));
  if (existing) {
    const stored = yield* Effect.promise(() =>
      ctx.db.system.get("_storage", existing.storageId)
    );
    if (matchesArchiveStorage(existing, stored)) {
      if (existing.storageId === storageId) {
        return {
          kind: "canonical",
          metadata: archiveMetadata(existing),
        } as const;
      }
    } else {
      yield* Effect.promise(() => ctx.db.delete(existing._id));
      if (existing.storageId === storageId) {
        deleted = yield* deleteUnreferencedArchiveStorage(
          ctx,
          existing.storageId
        );
      } else {
        yield* deleteUnreferencedArchiveStorage(ctx, existing.storageId);
      }
    }
  }
  yield* releaseProgram(ctx, args);
  return { kind: deleted ? "deleted" : "deferred" } as const;
});

/** Resolves one canonical archive and its bearer download capability once. */
export const download = internalQuery({
  args: runtimeArchiveIdentityValidator,
  returns: v.union(v.null(), runtimeArchiveDownloadValidator),
  handler: async (ctx: QueryCtx, args: ContentRuntimeArchiveIdentity) => {
    const archive = await loadArchive(ctx, args);
    if (!archive) {
      return null;
    }
    const [stored, downloadUrl] = await Promise.all([
      ctx.db.system.get("_storage", archive.storageId),
      ctx.storage.getUrl(archive.storageId),
    ]);
    if (!(downloadUrl && matchesArchiveStorage(archive, stored))) {
      return null;
    }
    return { ...archiveMetadata(archive), downloadUrl };
  },
});

export const claim = internalMutation({
  args: claimArgs,
  returns: runtimeArchiveClaimResultValidator,
  handler: (ctx, args) => runConvexProgram(claimProgram(ctx, args)),
});

export const release = internalMutation({
  args: claimArgs,
  returns: runtimeArchiveReleaseResultValidator,
  handler: (ctx, args) => runConvexProgram(releaseProgram(ctx, args)),
});

export const owns = internalMutation({
  args: claimArgs,
  returns: v.boolean(),
  handler: (ctx, args) => runConvexProgram(ownsProgram(ctx, args)),
});

export const finalize = internalMutation({
  args: {
    ...claimArgs,
    archiveSha256: v.string(),
    byteLength: v.number(),
    sourceStateHash: v.string(),
    storageId: v.string(),
  },
  returns: runtimeArchiveFinalizeResultValidator,
  handler: (ctx, args) => runConvexProgram(finalizeProgram(ctx, args)),
});

export const abort = internalMutation({
  args: { ...claimArgs, storageId: v.string() },
  returns: runtimeArchiveAbortResultValidator,
  handler: (ctx, args) => runConvexProgram(abortProgram(ctx, args)),
});
