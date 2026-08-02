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

interface PublicSetPath {
  readonly locale: TryoutSetIdentity["locale"];
  readonly publicPath: string;
}

/** Reads the latest attempt through the active signed or filesystem owner. */
export const readLatestAttempt = Effect.fn("tryouts.runtime.readLatestAttempt")(
  function* (ctx: QueryCtx, identity: TryoutSetIdentity, userId: UserId) {
    const catalog = yield* loadTryoutCatalog(ctx, identity.locale);
    if (catalog.managed) {
      const set = yield* readPublishedSet(catalog, identity);
      if (!set) {
        return null;
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
          .first()
      );
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
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_setIdentity_and_startedAt", (index) =>
          index
            .eq("userId", userId)
            .eq("setIdentity", tryoutCatalogIdentity(set))
        )
        .order("desc")
        .first()
    );
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
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutSetId_and_startedAt", (index) =>
        index.eq("userId", userId).eq("tryoutSetId", set._id)
      )
      .order("desc")
      .paginate(pagination)
  );
});

/** Returns the canonical empty attempt pagination result. */
function emptyAttemptPage() {
  return { continueCursor: "", isDone: true, page: [] };
}
