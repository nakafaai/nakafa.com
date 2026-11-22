import type { Docs } from "@repo/backend/confect/_generated/docs";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import {
  readCatalogNode,
  readCatalogSet,
} from "@repo/backend/confect/tryouts/catalog/rows";
import type { TryoutSetIdentity } from "@repo/backend/confect/tryouts/route";
import {
  loadAttemptSections,
  readAttemptResume,
} from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import {
  readAttemptHistoryPageBySet,
  readNewestAttempts,
} from "@repo/backend/confect/tryouts/runtime/lookup";
import { loadAttemptScoreResult } from "@repo/backend/confect/tryouts/score/result";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Option, Order } from "effect";

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

/** How many try-outs the home holds: the one it shows, and five folded under it. */
const RECENT_SETS = 6;
/** How many of the newest attempts are read to find them, since one set sat again and again fills several. */
const RECENT_ATTEMPTS_READ = 24;

/**
 * The order the home shows the try-outs in: every set that still runs first, the one whose time ends
 * soonest at the top, since it is the one the learner can lose; then the rest, newest first.
 */
export function homeOrder<
  A extends Pick<Docs["tryoutAttempts"], "expiresAt" | "status">,
>(attempts: readonly A[]) {
  const runs = (attempt: A) => attempt.status === "in-progress";
  return [
    ...Arr.sort(
      Arr.filter(attempts, runs),
      Order.mapInput(Order.Number, (attempt: A) => attempt.expiresAt)
    ),
    ...Arr.filter(attempts, (attempt) => !runs(attempt)),
  ];
}

/**
 * The try-outs the current app user sat last, one row a set, in the order the home shows them
 * (`homeOrder`): the set by the titles the active release gives its track and itself in the language
 * it was sat in, its country's flag code and its exam's key for its picture, the part to go on with
 * while it runs, how its newest attempt stands, its time, its answered and right questions, and its
 * published score once it has one. A set the active release no longer publishes has no page to open,
 * so it is left out. Each set is a few small reads by its identity, never the whole catalog.
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
    homeOrder(newest),
    Effect.fn("tryouts.queries.history.projectRecent")(function* (attempt) {
      const found = yield* readCatalogSet(
        snapshotId,
        attempt.setIdentity,
        attempt.appLocale
      );
      const country = {
        appLocale: attempt.appLocale,
        countryKey: attempt.countryKey,
      };
      const [place, track] = yield* Effect.all(
        [
          readCatalogNode(snapshotId, { ...country, kind: "country" }),
          readCatalogNode(snapshotId, {
            ...country,
            examKey: attempt.examKey,
            kind: "track",
            trackKey: attempt.trackKey,
          }),
        ],
        { concurrency: "unbounded" }
      );
      if (
        Option.isNone(found) ||
        Option.isNone(place) ||
        Option.isNone(track)
      ) {
        return Option.none();
      }
      const [result, sections] = yield* Effect.all(
        [loadAttemptScoreResult(attempt), loadAttemptSections(attempt)],
        { concurrency: "unbounded" }
      );
      const { resumeSectionKey } = readAttemptResume(attempt, sections);
      const part = Arr.findFirst(
        found.value.sections,
        (section) =>
          attempt.status === "in-progress" &&
          section.sectionKey === resumeSectionKey
      );
      return Option.some({
        answered: Arr.reduce(
          sections,
          0,
          (sum, section) => sum + section.answeredCount
        ),
        attemptId: attempt._id,
        correct: attempt.totalCorrect,
        countryCode: place.value.countryCode,
        examKey: attempt.examKey,
        expiresAt: attempt.expiresAt,
        part: Option.getOrNull(
          Option.map(part, (section) => ({
            key: section.sectionKey,
            title: section.title,
          }))
        ),
        publicPath: found.value.set.publicPath,
        questions: attempt.totalQuestions,
        score: Option.getOrNull(
          Option.map(
            Option.fromNullishOr(result),
            (score) => score.publishedScore
          )
        ),
        startedAt: attempt.startedAt,
        status: attempt.status,
        title: found.value.set.title,
        track: track.value.title,
      });
    }),
    { concurrency: "unbounded" }
  );
  return Arr.getSomes(rows);
});
