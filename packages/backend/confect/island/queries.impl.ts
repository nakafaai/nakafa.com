import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { todayOf } from "@repo/backend/confect/island/day";
import { leadersOf } from "@repo/backend/confect/island/leaders";
import spec from "@repo/backend/confect/island/queries.spec";
import { DAY_GRANTS } from "@repo/backend/confect/island/schema";
import { findIsland } from "@repo/backend/confect/island/store";
import { toOwnIsland } from "@repo/backend/confect/island/view";
import { streakOn, summaryOf, weekOf } from "@repo/backend/confect/island/week";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer, Option } from "effect";

/** The signed-in learner's island, none before their first grant or visit. */
const own = FunctionImpl.make(
  databaseSchema,
  spec,
  "own",
  Effect.fn("island.queries.own")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const island = yield* findIsland(user.appUser._id);
    return Option.match(island, { onNone: () => null, onSome: toOwnIsland });
  })
);

/**
 * The signed-in learner's week (ADR 0047): the grants of each day of this
 * week in their zone, at most a day's count each, and their run of days. None
 * before their first grant or visit.
 */
const week = FunctionImpl.make(
  databaseSchema,
  spec,
  "week",
  Effect.fn("island.queries.week")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const found = yield* findIsland(user.appUser._id);
    if (Option.isNone(found)) {
      return null;
    }
    const island = found.value;
    const today = yield* todayOf(island.timeZone);
    const database = yield* DatabaseReader;
    const days = yield* Effect.forEach(weekOf(today), (day) =>
      database
        .table("islandAwards")
        .index("by_userId_and_day", (query) =>
          query.eq("userId", island.userId).eq("day", day)
        )
        .take(DAY_GRANTS)
        .pipe(
          Effect.orDie,
          Effect.map((grants) => summaryOf(day, grants))
        )
    );
    return {
      days,
      streak: streakOn(island.learned, island.streak ?? 0, today),
      today,
    };
  })
);

/** The global leaderboard, the viewer's own row marked when they are on it (ADR 0047, D27). */
const leaders = FunctionImpl.make(
  databaseSchema,
  spec,
  "leaders",
  Effect.fn("island.queries.leaders")(function* () {
    const user = yield* getOptionalAppUserForRead();
    return yield* leadersOf(
      Option.map(Option.fromNullishOr(user), (found) => found.appUser._id)
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(own),
  Layer.provide(week),
  Layer.provide(leaders),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
