import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { todayOf } from "@repo/backend/confect/island/day";
import spec from "@repo/backend/confect/island/queries.spec";
import { runOn, tryoutDays } from "@repo/backend/confect/island/run";
import { DAY_GRANTS } from "@repo/backend/confect/island/schema";
import { findIsland } from "@repo/backend/confect/island/store";
import {
  toOwnIsland,
  toVisitedIsland,
} from "@repo/backend/confect/island/view";
import { streakOn, summaryOf, weekOf } from "@repo/backend/confect/island/week";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Option } from "effect";

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
 * Another learner's island by their address (ADR 0047, D18): only an island
 * its owner shared, and none for an address no one holds or an owner with no
 * island yet. Anyone may visit, signed in or not.
 */
const visit = FunctionImpl.make(
  databaseSchema,
  spec,
  "visit",
  Effect.fn("island.queries.visit")(function* ({ username }) {
    const database = yield* DatabaseReader;
    const owner = yield* database
      .table("users")
      .index("by_username", (query) => query.eq("username", username))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(owner)) {
      return null;
    }
    const island = yield* findIsland(owner.value._id);
    return Option.match(island, {
      onNone: () => null,
      onSome: (found) =>
        found.shared === true ? toVisitedIsland(found) : null,
    });
  })
);

/**
 * The signed-in learner's week (ADR 0047): the grants of each day of this
 * week in their zone, at most a day's count each, their run of days, and
 * their run of try-out days toward the Streak badge (D19). None before their
 * first grant or visit.
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
    const tried = yield* tryoutDays(island.userId, today);
    return {
      days,
      rewarded: Arr.some(island.badges, (earned) => earned.badge === "streak"),
      streak: streakOn(island.learned, island.streak ?? 0, today),
      today,
      tryouts: runOn(tried, today),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(own),
  Layer.provide(visit),
  Layer.provide(week),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
