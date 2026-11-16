import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import { readCatalogSet } from "@repo/backend/confect/tryouts/catalog/rows";
import type { TryoutSetIdentity } from "@repo/backend/confect/tryouts/route";
import {
  readAttemptHistoryPageBySet,
  readNewestAttempts,
} from "@repo/backend/confect/tryouts/runtime/lookup";
import { loadAttemptScoreResult } from "@repo/backend/confect/tryouts/score/result";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Option } from "effect";

const MAX_HISTORY_ROWS_READ = 25;
/** Loads and projects one bounded history page for the current app user. */
export const readHistoryPage = Effect.fn("tryouts.queries.history.readPage")(
  function* (identity: TryoutSetIdentity, paginationOpts: PaginationOptions) {
    const { appUser } = yield* requireAuth();
    const pagination = {
      ...paginationOpts,
      maximumRowsRead: Math.min(
        paginationOpts.maximumRowsRead ?? MAX_HISTORY_ROWS_READ,
        MAX_HISTORY_ROWS_READ
      ),
      numItems: Math.min(paginationOpts.numItems, MAX_HISTORY_ROWS_READ),
    };
    const history = yield* readAttemptHistoryPageBySet(
      identity,
      appUser._id,
      pagination
    );
    const page = yield* Effect.forEach(
      history.page,
      (attempt) =>
        loadAttemptScoreResult(attempt).pipe(
          Effect.map((score) => ({
            attemptId: attempt._id,
            attemptNumber: attempt.attemptNumber,
            completedAt: attempt.completedAt,
            score,
            startedAt: attempt.startedAt,
            status: attempt.status,
          }))
        ),
      {
        concurrency: "unbounded",
      }
    );
    return {
      ...history,
      page,
    };
  }
);

/** How many try-outs the home lists. */
const RECENT_SETS = 3;
/** How many of the newest attempts are read to find them, since one set sat again and again fills several. */
const RECENT_ATTEMPTS_READ = 12;

/**
 * The try-outs the current app user sat last, newest first, one row a set: the
 * set by the title and route the active release gives it in the language it
 * was sat in, how its newest attempt stands, and that attempt's published
 * score once it has one. A set the active release no longer publishes has no
 * page to open, so it is left out. Each set is one small read by its identity,
 * never the whole catalog.
 */
export const readRecentAttempts = Effect.fn(
  "tryouts.queries.history.readRecent"
)(function* () {
  const { appUser } = yield* requireAuth();
  const { snapshotId } = yield* loadActiveAssessment();
  const attempts = yield* readNewestAttempts(appUser._id, RECENT_ATTEMPTS_READ);
  const newest = Arr.take(
    Arr.dedupeWith(
      attempts,
      (first, second) => first.setIdentity === second.setIdentity
    ),
    RECENT_SETS
  );
  const rows = yield* Effect.forEach(
    newest,
    Effect.fn("tryouts.queries.history.projectRecent")(function* (attempt) {
      const found = yield* readCatalogSet(
        snapshotId,
        attempt.setIdentity,
        attempt.appLocale
      );
      if (Option.isNone(found)) {
        return Option.none();
      }
      const result = yield* loadAttemptScoreResult(attempt);
      return Option.some({
        attemptId: attempt._id,
        publicPath: found.value.set.publicPath,
        score: Option.getOrNull(
          Option.map(
            Option.fromNullishOr(result),
            (score) => score.publishedScore
          )
        ),
        status: attempt.status,
        title: found.value.set.title,
      });
    }),
    { concurrency: "unbounded" }
  );
  return Arr.getSomes(rows);
});
