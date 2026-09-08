import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { TryoutSet } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import type { PublishedCatalog } from "@repo/backend/content/tryout/hierarchy";
import {
  readPublishedSetSections,
  readPublishedTrackSets,
} from "@repo/backend/content/tryout/hierarchy";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_PROGRESS_IDENTITY_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { isTryoutProgressWithinReadBudget } from "@repo/backend/convex/tryouts/progress/size";
import {
  type PublishedSetRow,
  paginatePublishedSets,
} from "@repo/backend/convex/tryouts/sets/page";
import type {
  ListArgs,
  TrackIdentity,
} from "@repo/backend/convex/tryouts/sets/spec";
import { emptySetPage } from "@repo/backend/convex/tryouts/sets/spec";
import { Effect } from "effect";

type Progress = Doc<"tryoutSetProgress">;
type User = Doc<"users">;

/** Resolves one authorized, filtered, sorted page from the signed catalog. */
export const listPublishedSets = Effect.fn("tryouts.sets.listPublished")(
  function* (ctx: QueryCtx, args: ListArgs) {
    const [catalog, auth] = yield* Effect.all(
      [
        loadTryoutCatalog(args.locale).pipe(
          Effect.provide(convexTryoutLayer(ctx))
        ),
        Effect.promise(() => getOptionalAppUserForRead(ctx)),
      ],
      { concurrency: 2 }
    );
    const joined = yield* readJoinedSets(
      ctx,
      catalog,
      args,
      auth?.appUser ?? null
    );
    const scope = {
      snapshotId: catalog.snapshotId,
      viewerId: auth?.authUser._id ?? null,
    };
    if (!joined) {
      return { ...emptySetPage, ...scope };
    }
    const filter = args.filter;
    const filtered = joined.filter(({ progress }) => {
      if (filter === "all") {
        return true;
      }
      if (filter === "not-started") {
        return progress === null;
      }
      return progress?.status === filter;
    });
    const sorted = sortJoinedSets(filtered, args.sort);
    const page = yield* paginatePublishedSets(
      catalog,
      args.paginationOpts,
      sorted
    );
    return { ...page, ...scope };
  }
);

/** Joins every authored set with at most one stable user progress row. */
const readJoinedSets = Effect.fn("tryouts.sets.readPublishedProgress")(
  function* (
    ctx: QueryCtx,
    catalog: PublishedCatalog,
    identity: TrackIdentity,
    user: User | null
  ) {
    const found = yield* readPublishedTrackSets(catalog, identity);
    if (!found) {
      return null;
    }
    const progress = user
      ? yield* loadProgress(ctx, found.sets, identity.locale, user)
      : new Map<string, Progress>();
    return yield* Effect.forEach(
      found.sets,
      Effect.fn("tryouts.sets.projectPublished")(function* (set) {
        const sections = yield* readPublishedSetSections(found.index, set);
        return {
          durationSeconds: sections.reduce(
            (total, section) => total + section.timeLimitSeconds,
            0
          ),
          progress: progress.get(tryoutCatalogIdentity(set)) ?? null,
          set,
        };
      })
    );
  }
);

/** Loads progress only for the exact sets in the active signed catalog. */
const loadProgress = Effect.fn("tryouts.sets.loadPublishedProgress")(function* (
  ctx: QueryCtx,
  sets: readonly TryoutSet[],
  appLocale: AppLocaleCode,
  user: User
) {
  const entries = yield* Effect.forEach(
    sets,
    (set) => loadSetProgress(ctx, set, appLocale, user),
    { concurrency: 16 }
  );
  const byIdentity = new Map<string, Progress>();
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    if (byIdentity.has(entry.identity)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out catalog has duplicate set identities."
      );
    }
    byIdentity.set(entry.identity, entry.row);
  }
  return byIdentity;
});

/** Reads at most one user progress row for one exact authored route. */
const loadSetProgress = Effect.fn("tryouts.sets.loadPublishedSetProgress")(
  function* (
    ctx: QueryCtx,
    set: TryoutSet,
    appLocale: AppLocaleCode,
    user: User
  ) {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSetProgress")
        .withIndex(
          "by_userId_countryKey_examKey_trackKey_appLocale_setKey",
          (query) =>
            query
              .eq("userId", user._id)
              .eq("countryKey", set.countryKey)
              .eq("examKey", set.examKey)
              .eq("trackKey", set.trackKey)
              .eq("appLocale", appLocale)
              .eq("setKey", set.setKey)
        )
        .take(TRYOUT_PROGRESS_IDENTITY_LIMIT)
    );
    if (rows.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out progress has duplicate route identities."
      );
    }
    const row = rows[0];
    if (!row) {
      return null;
    }
    if (!isTryoutProgressWithinReadBudget(row)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out progress exceeds its catalog read budget."
      );
    }
    const identity = tryoutCatalogIdentity(set);
    if (row.setIdentity && row.setIdentity !== identity) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out progress conflicts with its route identity."
      );
    }
    return { identity, row };
  }
);

/** Sorts signed set rows before revision-bound pagination. */
function sortJoinedSets(
  rows: readonly PublishedSetRow[],
  sort: ListArgs["sort"]
) {
  const result = [...rows];
  result.sort((left, right) => {
    const authoredOrder =
      left.set.order - right.set.order ||
      tryoutCatalogIdentity(left.set).localeCompare(
        tryoutCatalogIdentity(right.set)
      );
    let comparison = authoredOrder;
    switch (sort.field) {
      case "publishedScore": {
        const leftScore = left.progress?.publishedScore ?? null;
        const rightScore = right.progress?.publishedScore ?? null;
        if (leftScore === null && rightScore === null) {
          return authoredOrder;
        }
        if (leftScore === null) {
          return 1;
        }
        if (rightScore === null) {
          return -1;
        }
        comparison = leftScore - rightScore;
        break;
      }
      case "readyQuestionCount":
        comparison = left.set.questionCount - right.set.questionCount;
        break;
      case "durationSeconds":
        comparison = left.durationSeconds - right.durationSeconds;
        break;
      case "title":
        comparison = left.set.title.localeCompare(right.set.title);
        break;
      default:
        break;
    }
    const directed = sort.direction === "desc" ? -comparison : comparison;
    return directed || authoredOrder;
  });
  return result;
}
