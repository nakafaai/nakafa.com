import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import {
  readPublishedSet,
  readPublishedSetByPath,
} from "@repo/backend/convex/tryouts/catalog/hierarchy";
import {
  getActiveTryoutSet,
  getActiveTryoutSetByPublicPath,
} from "@repo/backend/convex/tryouts/read";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

type UserId = Doc<"users">["_id"];
type TryoutAttempt = Doc<"tryoutAttempts">;

/** Both identities retained while one attempt row crosses source ownership. */
export interface AttemptOwnerIdentity {
  readonly setIdentity?: string;
  readonly tryoutSetId?: Doc<"tryoutSets">["_id"];
  readonly userId: UserId;
}

interface PublicSetPath {
  readonly locale: TryoutSetIdentity["locale"];
  readonly publicPath: string;
}

/** Selects the newest attempt after deduplicating dual-index migration rows. */
function selectLatestAttempt(attempts: readonly TryoutAttempt[]) {
  let latest: TryoutAttempt | null = null;

  for (const attempt of attempts) {
    if (
      !latest ||
      attempt.startedAt > latest.startedAt ||
      (attempt.startedAt === latest.startedAt &&
        attempt._creationTime > latest._creationTime)
    ) {
      latest = attempt;
    }
  }

  return latest;
}

/** Deduplicates attempts that are visible through both migration indexes. */
function uniqueAttempts(attempts: readonly TryoutAttempt[]) {
  const unique = new Map<TryoutAttempt["_id"], TryoutAttempt>();

  for (const attempt of attempts) {
    unique.set(attempt._id, attempt);
  }

  return Array.from(unique.values());
}

/** Reads a bounded attempt set across signed and retained filesystem keys. */
export const readOwnedAttempts = Effect.fn("tryouts.runtime.readOwnedAttempts")(
  function* (ctx: QueryCtx, owner: AttemptOwnerIdentity, limit: number) {
    let signed: readonly TryoutAttempt[] = [];
    if (owner.setIdentity) {
      signed = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_userId_and_setIdentity_and_startedAt", (index) =>
            index
              .eq("userId", owner.userId)
              .eq("setIdentity", owner.setIdentity)
          )
          .order("desc")
          .take(limit)
      );
    }

    let filesystem: readonly TryoutAttempt[] = [];
    if (owner.tryoutSetId) {
      filesystem = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_userId_and_tryoutSetId_and_startedAt", (index) =>
            index
              .eq("userId", owner.userId)
              .eq("tryoutSetId", owner.tryoutSetId)
          )
          .order("desc")
          .take(limit)
      );
    }

    return uniqueAttempts([...signed, ...filesystem]);
  }
);

/** Reads the newest attempt across both identities during additive migration. */
export const readLatestOwnedAttempt = Effect.fn(
  "tryouts.runtime.readLatestOwnedAttempt"
)(function* (ctx: QueryCtx, owner: AttemptOwnerIdentity) {
  const attempts = yield* readOwnedAttempts(ctx, owner, 1);
  return selectLatestAttempt(attempts);
});

/** Reads the latest attempt through the active signed or filesystem owner. */
export const readLatestAttempt = Effect.fn("tryouts.runtime.readLatestAttempt")(
  function* (ctx: QueryCtx, identity: TryoutSetIdentity, userId: UserId) {
    const catalog = yield* loadTryoutCatalog(ctx, identity.locale);
    if (catalog.managed) {
      const set = yield* readPublishedSet(catalog, identity);
      if (!set) {
        return null;
      }
      const legacy = yield* Effect.promise(() =>
        getActiveTryoutSet(ctx, identity)
      );
      return yield* readLatestOwnedAttempt(ctx, {
        setIdentity: tryoutCatalogIdentity(set),
        tryoutSetId: legacy?._id,
        userId,
      });
    }

    const set = yield* Effect.promise(() => getActiveTryoutSet(ctx, identity));
    if (!set) {
      return null;
    }
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutSetId_and_startedAt", (index) =>
          index.eq("userId", userId).eq("tryoutSetId", set._id)
        )
        .order("desc")
        .first()
    );
  }
);

/** Reads the latest attempt for one localized public set route. */
export const readLatestAttemptByPath = Effect.fn(
  "tryouts.runtime.readLatestAttemptByPath"
)(function* (ctx: QueryCtx, path: PublicSetPath, userId: UserId) {
  const catalog = yield* loadTryoutCatalog(ctx, path.locale);
  if (catalog.managed) {
    const set = yield* readPublishedSetByPath(catalog, path.publicPath);
    if (!set) {
      return null;
    }
    const legacy = yield* Effect.promise(() =>
      getActiveTryoutSetByPublicPath(ctx, path)
    );
    return yield* readLatestOwnedAttempt(ctx, {
      setIdentity: tryoutCatalogIdentity(set),
      tryoutSetId: legacy?._id,
      userId,
    });
  }

  const set = yield* Effect.promise(() =>
    getActiveTryoutSetByPublicPath(ctx, path)
  );
  if (!set) {
    return null;
  }
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutSetId_and_startedAt", (index) =>
        index.eq("userId", userId).eq("tryoutSetId", set._id)
      )
      .order("desc")
      .first()
  );
});

/** Reads one bounded attempt history page through the active content owner. */
export const readAttemptHistoryPage = Effect.fn(
  "tryouts.runtime.readAttemptHistoryPage"
)(function* (
  ctx: QueryCtx,
  path: PublicSetPath,
  userId: UserId,
  pagination: PaginationOptions
) {
  const catalog = yield* loadTryoutCatalog(ctx, path.locale);
  if (catalog.managed) {
    const set = yield* readPublishedSetByPath(catalog, path.publicPath);
    if (!set) {
      return emptyAttemptPage();
    }
    const retained = yield* Effect.promise(() =>
      getActiveTryoutSetByPublicPath(ctx, path)
    );
    if (retained) {
      return yield* paginateFilesystemAttempts(
        ctx,
        retained._id,
        userId,
        pagination
      );
    }
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_setIdentity_and_startedAt", (index) =>
          index
            .eq("userId", userId)
            .eq("setIdentity", tryoutCatalogIdentity(set))
        )
        .order("desc")
        .paginate(pagination)
    );
  }

  const set = yield* Effect.promise(() =>
    getActiveTryoutSetByPublicPath(ctx, path)
  );
  if (!set) {
    return emptyAttemptPage();
  }
  return yield* paginateFilesystemAttempts(ctx, set._id, userId, pagination);
});

/** Paginates the retained local identity while signed migration is additive. */
function paginateFilesystemAttempts(
  ctx: QueryCtx,
  tryoutSetId: Doc<"tryoutSets">["_id"],
  userId: UserId,
  pagination: PaginationOptions
) {
  return Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutSetId_and_startedAt", (index) =>
        index.eq("userId", userId).eq("tryoutSetId", tryoutSetId)
      )
      .order("desc")
      .paginate(pagination)
  );
}

/** Returns the canonical empty attempt pagination result. */
function emptyAttemptPage() {
  return { continueCursor: "", isDone: true, page: [] };
}
