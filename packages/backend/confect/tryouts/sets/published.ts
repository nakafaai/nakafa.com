import {
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { TryoutSet } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { TRYOUT_PROGRESS_IDENTITY_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { isTryoutProgressWithinReadBudget } from "@repo/backend/confect/tryouts/progress/size";
import { readAttemptDestination } from "@repo/backend/confect/tryouts/runtime/attempt/destination";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import {
  type PublishedSetRow,
  paginatePublishedSets,
} from "@repo/backend/confect/tryouts/sets/page";
import type {
  ListArgs,
  TrackIdentity,
} from "@repo/backend/confect/tryouts/sets/spec";
import { emptySetPage } from "@repo/backend/confect/tryouts/sets/spec";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import type { PublishedCatalog } from "@repo/backend/content/tryout/hierarchy";
import {
  readPublishedSetSections,
  readPublishedTrackSets,
} from "@repo/backend/content/tryout/hierarchy";
import { Array as Arr, Effect, MutableHashMap, Option, Order } from "effect";

type Progress = Docs["tryoutSetProgress"];
type User = Docs["users"];

/** Resolves one authorized, filtered, sorted page from the signed catalog. */
export const listPublishedSets = Effect.fn("tryouts.sets.listPublished")(
  function* (args: ListArgs) {
    const [catalog, auth] = yield* Effect.all(
      [
        loadTryoutCatalog(args.locale).pipe(Effect.provide(tryoutLayer)),
        getOptionalAppUserForRead(),
      ],
      {
        concurrency: 2,
      }
    );
    const joined = yield* readJoinedSets(catalog, args, auth?.appUser ?? null);
    const scope = {
      snapshotId: catalog.snapshotId,
      viewerId: auth?.authId ?? null,
    };
    if (!joined) {
      return {
        ...emptySetPage,
        ...scope,
      };
    }
    const filter = args.filter;
    const filtered = Arr.filter(joined, ({ progress }) => {
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
    return {
      ...page,
      ...scope,
    };
  }
);

/** Joins every authored set with at most one stable user progress row. */
const readJoinedSets = Effect.fn("tryouts.sets.readPublishedProgress")(
  function* (
    catalog: PublishedCatalog,
    identity: TrackIdentity,
    user: User | null
  ) {
    const found = yield* readPublishedTrackSets(catalog, identity);
    if (!found) {
      return null;
    }
    const progress = user
      ? yield* loadProgress(found.sets, user)
      : MutableHashMap.empty<string, Progress>();
    return yield* Effect.forEach(
      found.sets,
      Effect.fn("tryouts.sets.projectPublished")(function* (set) {
        const sections = yield* readPublishedSetSections(found.index, set);
        const row = Option.getOrNull(
          MutableHashMap.get(progress, tryoutCatalogIdentity(set))
        );
        return {
          durationSeconds: Arr.reduce(
            sections,
            0,
            (total, section) => total + section.timeLimitSeconds
          ),
          progress: row,
          runningAttempt: yield* readRunningAttempt(row, identity.locale),
          set,
        };
      })
    );
  }
);

/**
 * Reads the page a set's running attempt continues on, the same one a public
 * set URL would send the learner to, so its row can open it directly.
 */
const readRunningAttempt = Effect.fn("tryouts.sets.readRunningAttempt")(
  function* (progress: Progress | null, locale: AppLocaleCode) {
    if (progress?.status !== "in-progress") {
      return null;
    }
    const attempt = yield* readOwnedAttemptById(
      progress.latestAttemptId,
      progress.userId
    );
    if (attempt?.status !== "in-progress") {
      return null;
    }
    const publicPath = yield* readAttemptDestination(attempt, locale);
    return publicPath ? { attemptId: attempt._id, publicPath } : null;
  }
);

/** Loads progress only for the exact sets in the active signed catalog. */
const loadProgress = Effect.fn("tryouts.sets.loadPublishedProgress")(function* (
  sets: readonly TryoutSet[],
  user: User
) {
  const entries = yield* Effect.forEach(
    sets,
    (set) => loadSetProgress(set, user),
    {
      concurrency: 16,
    }
  );
  const byIdentity = MutableHashMap.empty<string, Progress>();
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    if (MutableHashMap.has(byIdentity, entry.identity)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out catalog has duplicate set identities."
      );
    }
    MutableHashMap.set(byIdentity, entry.identity, entry.row);
  }
  return byIdentity;
});

/** Reads at most one user progress row for one exact authored route. */
const loadSetProgress = Effect.fn("tryouts.sets.loadPublishedSetProgress")(
  function* (set: TryoutSet, user: User) {
    const database = yield* DatabaseReader;
    const rows = yield* database
      .table("tryoutSetProgress")
      .index("by_userId_and_set", (query) =>
        query
          .eq("userId", user._id)
          .eq("countryKey", set.countryKey)
          .eq("examKey", set.examKey)
          .eq("trackKey", set.trackKey)
          .eq("setKey", set.setKey)
      )
      .take(TRYOUT_PROGRESS_IDENTITY_LIMIT)
      .pipe(Effect.orDie);
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
    if (
      row.setIdentity &&
      row.setIdentity !==
        tryoutCatalogIdentity({
          ...set,
          appLocale: AppLocaleSchema.make(row.appLocale),
        })
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out progress conflicts with its route identity."
      );
    }
    return {
      identity,
      row,
    };
  }
);

/** Sorts signed set rows before revision-bound pagination. */
function sortJoinedSets(
  rows: readonly PublishedSetRow[],
  sort: ListArgs["sort"]
) {
  /** Compares two rows by the requested field, then by authored order. */
  const compare = (left: PublishedSetRow, right: PublishedSetRow) => {
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
  };
  return Arr.sort(
    rows,
    Order.make<PublishedSetRow>((left, right) =>
      Order.Number(compare(left, right), 0)
    )
  );
}
