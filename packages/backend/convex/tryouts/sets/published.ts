import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { TryoutSet } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { PublishedCatalog } from "@repo/backend/content/tryout/hierarchy";
import { readPublishedTrackSets } from "@repo/backend/content/tryout/hierarchy";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_PROGRESS_IDENTITY_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { isTryoutProgressWithinReadBudget } from "@repo/backend/convex/tryouts/progress/size";
import {
  type PublishedSetRow,
  paginatePublishedSets,
} from "@repo/backend/convex/tryouts/sets/page";
import type {
  ListArgs,
  StatusArgs,
  TrackIdentity,
  UnattemptedArgs,
} from "@repo/backend/convex/tryouts/sets/spec";
import { Effect } from "effect";

type Progress = Doc<"tryoutSetProgress">;
type User = Doc<"users">;

interface ScoredSet extends PublishedSetRow {
  readonly progress: Progress & { readonly publishedScore: number };
}

/** Lists one signed catalog page with optional authenticated progress. */
export const listPublishedSets = Effect.fn("tryouts.sets.listPublished")(
  function* (
    ctx: QueryCtx,
    catalog: PublishedCatalog,
    args: ListArgs,
    user: User | null
  ) {
    const joined = yield* readJoinedSets(ctx, catalog, args, user);
    if (!joined) {
      return emptyPage();
    }
    const sorted = sortJoinedSets(joined, args.sort);
    return yield* paginatePublishedSets(catalog, args.paginationOpts, sorted);
  }
);

/** Lists one exact signed attempt status after joining stable progress rows. */
export const listPublishedSetsByStatus = Effect.fn(
  "tryouts.sets.listPublishedByStatus"
)(function* (
  ctx: QueryCtx,
  catalog: PublishedCatalog,
  args: StatusArgs,
  user: User
) {
  const joined = yield* readJoinedSets(ctx, catalog, args, user);
  if (!joined) {
    return emptyPage();
  }
  const rows = joined.filter(
    ({ progress }) => progress?.status === args.status
  );
  return yield* paginatePublishedSets(catalog, args.paginationOpts, rows);
});

/** Lists signed sets without progress for the current optional user. */
export const listPublishedUnattemptedSets = Effect.fn(
  "tryouts.sets.listPublishedUnattempted"
)(function* (
  ctx: QueryCtx,
  catalog: PublishedCatalog,
  args: UnattemptedArgs,
  user: User | null
) {
  const joined = yield* readJoinedSets(ctx, catalog, args, user);
  if (!joined) {
    return emptyPage();
  }
  const rows = joined.filter(({ progress }) => progress === null);
  return yield* paginatePublishedSets(catalog, args.paginationOpts, rows);
});

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
    return found.sets.map((set) => ({
      progress: progress.get(tryoutCatalogIdentity(set)) ?? null,
      set,
    }));
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
    { concurrency: "unbounded" }
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
  if (sort.field === "publishedScore") {
    return sortByScore(rows, sort.direction);
  }
  const result = [...rows];
  result.sort((left, right) => {
    let comparison = left.set.order - right.set.order;
    if (sort.field === "readyQuestionCount") {
      comparison = left.set.questionCount - right.set.questionCount;
    }
    if (sort.field === "title") {
      comparison = left.set.title.localeCompare(right.set.title);
    }
    if (comparison === 0) {
      comparison = left.set.order - right.set.order;
    }
    return sort.direction === "desc" ? -comparison : comparison;
  });
  return result;
}

/** Sorts scored rows first and leaves unscored rows in authored order. */
function sortByScore(
  rows: readonly PublishedSetRow[],
  direction: ListArgs["sort"]["direction"]
) {
  const scored = rows.filter(hasPublishedScore);
  const unscored = rows.filter((row) => !hasPublishedScore(row));
  scored.sort((left, right) => {
    const comparison =
      left.progress.publishedScore - right.progress.publishedScore;
    return direction === "desc" ? -comparison : comparison;
  });
  unscored.sort((left, right) => left.set.order - right.set.order);
  return [...scored, ...unscored];
}

/** Narrows one joined row to progress with a real published score. */
function hasPublishedScore(row: PublishedSetRow): row is ScoredSet {
  return row.progress !== null && row.progress.publishedScore !== null;
}

/** Returns the shared empty immutable page shape. */
function emptyPage() {
  return { continueCursor: "", isDone: true, page: [] };
}
