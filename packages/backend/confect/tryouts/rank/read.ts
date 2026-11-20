import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { leaderNameOf } from "@repo/backend/confect/island/leaders";
import { setRanks } from "@repo/backend/confect/tryouts/rank/board";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericQueryCtx } from "convex/server";
import { Array as Arr, Effect, Option } from "effect";

/** How many learners a set's leaderboard shows. */
const SET_LEADER_COUNT = 10;

/** Reads the board in the caller's query, its failure a try-out runtime failure. */
const fromBoard = Effect.fn("tryouts.rank.fromBoard")(function* <A>(
  read: (ctx: GenericQueryCtx<DataModel>) => Promise<A>
) {
  const ctx = yield* QueryCtx;
  return yield* Effect.tryPromise({
    try: () => read(ctx),
    catch: toTryoutRuntimeError,
  });
});

/** The place a score takes on a set's board: one more than the learners whose best is higher, so a tie shares it. */
const placeOf = (setIdentity: string, score: number) =>
  fromBoard((ctx) =>
    setRanks.count(ctx, {
      bounds: { upper: { inclusive: false, key: -score } },
      namespace: setIdentity,
    })
  ).pipe(Effect.map((above) => above + 1));

/** A best as a board row: the best itself, its learner's first name and mascot, its score, and whether it is the viewer's. */
const rowOf = Effect.fn("tryouts.rank.rowOf")(function* (
  best: Docs["tryoutSetBests"],
  viewer: Option.Option<Docs["users"]["_id"]>
) {
  const database = yield* DatabaseReader;
  const user = yield* database.table("users").get(best.userId);
  return {
    id: best._id,
    mascot: user.mascot,
    name: leaderNameOf(user.name),
    own: Option.exists(viewer, (id) => id === best.userId),
    score: best.publishedScore,
  };
});

/** A board row with the place its score takes. */
const placedOn =
  (setIdentity: string) =>
  <Row extends { readonly score: number }>(row: Row) =>
    placeOf(setIdentity, row.score).pipe(
      Effect.map((place) => ({ ...row, place }))
    );

/**
 * One set's leaderboard (ADR 0047, D27): the learners with the highest best scores, each by the first
 * word of their name and their mascot, the viewer's own row with its place, how many learners are on
 * the board, and the place a score the page shows would take. A learner whose account is gone is left
 * out of the rows.
 */
export const readSetBoard = Effect.fn("tryouts.rank.readSetBoard")(function* (
  setIdentity: string,
  viewer: Option.Option<Docs["users"]["_id"]>,
  score: Option.Option<number>
) {
  const database = yield* DatabaseReader;
  const [count, top] = yield* Effect.all([
    fromBoard((ctx) => setRanks.count(ctx, { namespace: setIdentity })),
    fromBoard((ctx) =>
      setRanks.paginate(ctx, {
        namespace: setIdentity,
        order: "asc",
        pageSize: SET_LEADER_COUNT,
      })
    ),
  ]);
  const rows = yield* Effect.forEach(top.page, (item) =>
    database
      .table("tryoutSetBests")
      .get(item.id)
      .pipe(
        Effect.flatMap((best) => rowOf(best, viewer)),
        Effect.option
      )
  );
  const leaders = yield* Effect.forEach(
    Arr.getSomes(rows),
    placedOn(setIdentity)
  );
  const best = yield* Option.match(viewer, {
    onNone: () => Effect.succeedNone,
    onSome: (userId) =>
      database
        .table("tryoutSetBests")
        .index("by_userId_and_setIdentity", (query) =>
          query.eq("userId", userId).eq("setIdentity", setIdentity)
        )
        .first()
        .pipe(Effect.orDie),
  });
  const ownRow = yield* Option.match(best, {
    onNone: () => Effect.succeedNone,
    onSome: (row) => Effect.option(rowOf(row, viewer)),
  });
  const own = yield* Option.match(ownRow, {
    onNone: () => Effect.succeed(null),
    onSome: placedOn(setIdentity),
  });
  const standing = yield* Option.match(score, {
    onNone: () => Effect.succeed(null),
    onSome: (value) => placeOf(setIdentity, value),
  });
  return { count, leaders, own, standing };
});
