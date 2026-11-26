import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { claimsOf } from "@repo/backend/confect/progress/claims";
import { todayOf } from "@repo/backend/confect/progress/day";
import { leadersOf } from "@repo/backend/confect/progress/leaders";
import { growthOf } from "@repo/backend/confect/progress/level";
import spec from "@repo/backend/confect/progress/queries.spec";
import { DAY_GRANTS, EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import { findProgress } from "@repo/backend/confect/progress/store";
import {
  streakOn,
  summaryOf,
  weekOf,
} from "@repo/backend/confect/progress/week";
import {
  decodeTryoutSetIdentity,
  tryoutSetIdentityOf,
} from "@repo/backend/confect/tryouts/route";
import { getAppUserByUsername } from "@repo/backend/confect/users/directory";
import { profileAccess } from "@repo/backend/confect/users/profile";
import { Effect, Layer, Option } from "effect";

/** The signed-in learner's lifetime Stars and tally, none before their first grant. */
const growth = FunctionImpl.make(
  databaseSchema,
  spec,
  "growth",
  Effect.fn("progress.queries.growth")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    return Option.match(yield* findProgress(user.appUser._id), {
      onNone: () => null,
      onSome: (record) => ({ lifetime: record.lifetime, tally: record.tally }),
    });
  })
);

/**
 * The signed-in learner's week: the grants of each day of this week in their
 * zone, at most a day's count each, and their run of days. None before their
 * first grant.
 */
const week = FunctionImpl.make(
  databaseSchema,
  spec,
  "week",
  Effect.fn("progress.queries.week")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const found = yield* findProgress(user.appUser._id);
    if (Option.isNone(found)) {
      return null;
    }
    const record = found.value;
    const today = yield* todayOf(record.timeZone);
    const database = yield* DatabaseReader;
    const days = yield* Effect.forEach(weekOf(today), (day) =>
      database
        .table("progressAwards")
        .index("by_userId_and_day", (query) =>
          query.eq("userId", record.userId).eq("day", day)
        )
        .take(DAY_GRANTS)
        .pipe(
          Effect.orDie,
          Effect.map((grants) => summaryOf(day, grants))
        )
    );
    return {
      days,
      streak: streakOn(record.learned, record.streak ?? 0, today),
      today,
    };
  })
);

/** The global leaderboard, the viewer's own row marked when they are on it. */
const leaders = FunctionImpl.make(
  databaseSchema,
  spec,
  "leaders",
  Effect.fn("progress.queries.leaders")(function* () {
    const user = yield* getOptionalAppUserForRead();
    return yield* leadersOf(
      Option.map(Option.fromNullishOr(user), (found) => found.appUser._id)
    );
  })
);

/**
 * What the signed-in learner already holds of one try-out set's Stars, which
 * its pane shows beside what the set gives. None for a visitor.
 */
const claims = FunctionImpl.make(
  databaseSchema,
  spec,
  "claims",
  Effect.fn("progress.queries.claims")(function* (keys) {
    const identity = yield* decodeTryoutSetIdentity(keys);
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    return yield* claimsOf(user.appUser._id, tryoutSetIdentityOf(identity));
  })
);

/**
 * The medals of the learner a profile address names, for whoever may open that
 * profile (`profileAccess`); a name nobody holds and a profile that does not
 * open both answer nothing. A learner with no progress yet has counted nothing.
 */
const medals = FunctionImpl.make(
  databaseSchema,
  spec,
  "medals",
  Effect.fn("progress.queries.medals")(function* ({ username }) {
    const owner = yield* getAppUserByUsername(username);
    if (!owner) {
      return null;
    }
    const viewer = yield* getOptionalAppUserForRead();
    const access = yield* profileAccess(owner._id, viewer?.appUser._id ?? null);
    if (!access.opens) {
      return null;
    }
    return Option.match(yield* findProgress(owner._id), {
      onNone: () => ({ level: 1, tally: EMPTY_TALLY }),
      onSome: (record) => ({
        level: growthOf(record.lifetime).level,
        tally: record.tally,
      }),
    });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(claims),
  Layer.provide(growth),
  Layer.provide(medals),
  Layer.provide(week),
  Layer.provide(leaders),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
