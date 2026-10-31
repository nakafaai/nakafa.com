import type { CatalogSetSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { isTryoutProgressWithinReadBudget } from "@repo/backend/confect/tryouts/progress/size";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
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
import {
  loadTryoutCatalog,
  type PublishedCatalog,
} from "@repo/backend/content/tryout/catalog";
import { readSetFacts } from "@repo/backend/content/tryout/facts";
import {
  readPublishedSetSections,
  readPublishedTrackSets,
} from "@repo/backend/content/tryout/hierarchy";
import {
  Array as Arr,
  Effect,
  HashMap,
  Match,
  MutableHashMap,
  Option,
  Order,
} from "effect";

type CatalogSet = typeof CatalogSetSchema.Type;
type Progress = Docs["tryoutSetProgress"];
type User = Docs["users"];

/** Rows read for one set to detect a duplicate progress row. */
const PROGRESS_IDENTITY_LIMIT = 2;

/** Resolves one authorized, filtered, sorted page from the signed catalog. */
export const listPublishedSets = Effect.fn("tryouts.sets.listPublished")(
  function* (args: ListArgs) {
    const [catalog, auth] = yield* Effect.all(
      [loadTryoutCatalog(args.locale), getOptionalAppUserForRead()],
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

/** Joins every set of a track with its facts, its sections, and at most one progress row of the user. */
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
    const facts = yield* readSetFacts(catalog.snapshotId, found.sets);
    return yield* Effect.forEach(
      found.sets,
      Effect.fn("tryouts.sets.projectPublished")(function* (set) {
        const setFacts = yield* Effect.fromOption(
          HashMap.get(facts, tryoutSetIdentityOf(set))
        ).pipe(
          // The facts were read for every set of the track.
          Effect.orDie
        );
        const row = Option.getOrNull(
          MutableHashMap.get(progress, tryoutSetIdentityOf(set))
        );
        return {
          durationSeconds: Arr.reduce(
            setFacts.sections,
            0,
            (total, section) => total + section.timeLimitSeconds
          ),
          facts: setFacts,
          progress: row,
          runningAttempt: yield* readRunningAttempt(row, identity.locale),
          sections: readPublishedSetSections(found.index, set),
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

/** Loads progress only for the sets of the active catalog's track. */
const loadProgress = Effect.fn("tryouts.sets.loadPublishedProgress")(function* (
  sets: readonly CatalogSet[],
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
        "The try-out catalog holds one set twice."
      );
    }
    MutableHashMap.set(byIdentity, entry.identity, entry.row);
  }
  return byIdentity;
});

/** Reads at most one progress row of the user for one set. */
const loadSetProgress = Effect.fn("tryouts.sets.loadPublishedSetProgress")(
  function* (set: CatalogSet, user: User) {
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
      .take(PROGRESS_IDENTITY_LIMIT)
      .pipe(Effect.orDie);
    if (rows.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out progress holds one set twice."
      );
    }
    const row = rows[0];
    if (!row) {
      return null;
    }
    if (!isTryoutProgressWithinReadBudget(row)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out progress exceeds its read budget."
      );
    }
    const identity = tryoutSetIdentityOf(set);
    if (row.setIdentity !== identity) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out progress names another set than its keys."
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
  /** Authored order, which also breaks every tie. */
  const authoredOrder = (left: PublishedSetRow, right: PublishedSetRow) =>
    left.set.order - right.set.order ||
    tryoutSetIdentityOf(left.set).localeCompare(tryoutSetIdentityOf(right.set));
  /** Applies the requested direction to one field difference. */
  const directed = (
    difference: number,
    left: PublishedSetRow,
    right: PublishedSetRow
  ) =>
    (sort.direction === "desc" ? -difference : difference) ||
    authoredOrder(left, right);
  /** Compares two rows by the requested field, then by authored order. */
  const compare = Match.value(sort.field).pipe(
    Match.withReturnType<
      (left: PublishedSetRow, right: PublishedSetRow) => number
    >(),
    Match.when(
      "order",
      () => (left, right) => directed(authoredOrder(left, right), left, right)
    ),
    Match.when("publishedScore", () => (left, right) => {
      const leftScore = left.progress?.publishedScore ?? null;
      const rightScore = right.progress?.publishedScore ?? null;
      if (leftScore === null && rightScore === null) {
        return authoredOrder(left, right);
      }
      if (leftScore === null) {
        return 1;
      }
      if (rightScore === null) {
        return -1;
      }
      return directed(leftScore - rightScore, left, right);
    }),
    Match.when(
      "questionCount",
      () => (left, right) =>
        directed(
          left.facts.questionCount - right.facts.questionCount,
          left,
          right
        )
    ),
    Match.when(
      "durationSeconds",
      () => (left, right) =>
        directed(left.durationSeconds - right.durationSeconds, left, right)
    ),
    Match.when(
      "title",
      () => (left, right) =>
        directed(left.set.title.localeCompare(right.set.title), left, right)
    ),
    Match.exhaustive
  );
  return Arr.sort(
    rows,
    Order.make<PublishedSetRow>((left, right) =>
      Order.Number(compare(left, right), 0)
    )
  );
}
