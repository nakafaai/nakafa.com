import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import type { PublishedCatalog } from "@repo/backend/convex/tryouts/catalog/hierarchy";
import { readPublishedTrackSets } from "@repo/backend/convex/tryouts/catalog/hierarchy";
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
      ? yield* loadProgress(ctx, identity, user)
      : new Map<string, Progress>();
    return found.sets.map((set) => ({
      progress: progress.get(tryoutCatalogIdentity(set)) ?? null,
      set,
    }));
  }
);

/** Loads the bounded current-user progress rows for one authored track. */
const loadProgress = Effect.fn("tryouts.sets.loadPublishedProgress")(function* (
  ctx: QueryCtx,
  identity: TrackIdentity,
  user: User
) {
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutSetProgress")
      .withIndex("by_userId_and_track_and_publishedScore_and_setKey", (query) =>
        query
          .eq("userId", user._id)
          .eq("countryKey", identity.countryKey)
          .eq("examKey", identity.examKey)
          .eq("trackKey", identity.trackKey)
          .eq("locale", identity.locale)
      )
      .take(TRYOUT_CATALOG_LIMIT + 1)
  );
  if (rows.length > TRYOUT_CATALOG_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      "Signed try-out progress exceeds the catalog row budget."
    );
  }
  const byIdentity = new Map<string, Progress>();
  for (const row of rows) {
    const identity = tryoutCatalogIdentity({
      countryKey: row.countryKey,
      examKey: row.examKey,
      kind: "set",
      locale: row.locale,
      setKey: row.setKey,
      trackKey: row.trackKey,
    });
    if (row.setIdentity && row.setIdentity !== identity) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out progress conflicts with its route identity."
      );
    }
    if (byIdentity.has(identity)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out progress has duplicate set identities."
      );
    }
    byIdentity.set(identity, row);
  }
  return byIdentity;
});

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
