import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { claimsOf } from "@repo/backend/confect/island/claims";
import { REGION_CHUNKS } from "@repo/backend/confect/island/chunk";
import { todayOf } from "@repo/backend/confect/island/day";
import { guestsOf } from "@repo/backend/confect/island/guests";
import { leaderNameOf, leadersOf } from "@repo/backend/confect/island/leaders";
import { growthOf } from "@repo/backend/confect/island/level";
import spec from "@repo/backend/confect/island/queries.spec";
import {
  DAY_GRANTS,
  EMPTY_TALLY,
  FIRST_ACCESS,
} from "@repo/backend/confect/island/schema";
import { findIsland } from "@repo/backend/confect/island/store";
import { toOwnIsland } from "@repo/backend/confect/island/view";
import { worldOf } from "@repo/backend/confect/island/visit";
import { streakOn, summaryOf, weekOf } from "@repo/backend/confect/island/week";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  decodeTryoutSetIdentity,
  tryoutSetIdentityOf,
} from "@repo/backend/confect/tryouts/route";
import { getAppUserByUsername } from "@repo/backend/confect/users/directory";
import { profileAccess } from "@repo/backend/confect/users/profile";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

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

/** The signed-in learner's lifetime Stars and tally, none before their first grant or visit. */
const growth = FunctionImpl.make(
  databaseSchema,
  spec,
  "growth",
  Effect.fn("island.queries.growth")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    return Option.match(yield* findIsland(user.appUser._id), {
      onNone: () => null,
      onSome: (island) => ({ lifetime: island.lifetime, tally: island.tally }),
    });
  })
);

/**
 * The changed chunks of one region of a world, 8 by 8 chunks, as the browser
 * lays them over the generated land (ADR 0050, W3): the signed-in learner's
 * own world when no address is given, otherwise the world at that address
 * when it opens to the caller. No such world, and one that does not open,
 * answer no chunks.
 */
const region = FunctionImpl.make(
  databaseSchema,
  spec,
  "region",
  Effect.fn("island.queries.region")(function* ({ rx, rz, username }) {
    const owner =
      username === null
        ? Option.map(
            Option.fromNullishOr(yield* getOptionalAppUserForRead()),
            (viewer) => viewer.appUser._id
          )
        : Option.map(yield* worldOf(username), (world) => world.owner._id);
    if (Option.isNone(owner)) {
      return [];
    }
    const database = yield* DatabaseReader;
    const rows = yield* database
      .table("islandChunks")
      .index("by_userId_and_rx_and_rz", (query) =>
        query.eq("userId", owner.value).eq("rx", rx).eq("rz", rz)
      )
      .take(REGION_CHUNKS)
      .pipe(Effect.orDie);
    return Arr.map(
      rows,
      Struct.pick(["clears", "cx", "cz", "lifts", "paints", "things"])
    );
  })
);

/**
 * What a visitor needs to open the world at an address (ADR 0050, W6), none
 * when no world stands there or it does not open to the caller (`worldOf`).
 */
const visit = FunctionImpl.make(
  databaseSchema,
  spec,
  "visit",
  Effect.fn("island.queries.visit")(function* ({ username }) {
    return Option.match(yield* worldOf(username), {
      onNone: () => null,
      onSome: ({ island, own, owner }) => ({
        access: island.access ?? FIRST_ACCESS,
        level: growthOf(island.lifetime).level,
        mascot: owner.mascot,
        name: leaderNameOf(owner.name),
        own,
        owner: owner._id,
      }),
    });
  })
);

/** The newest guests of the signed-in learner's own world, none when signed out (ADR 0050, W6). */
const guests = FunctionImpl.make(
  databaseSchema,
  spec,
  "guests",
  Effect.fn("island.queries.guests")(function* () {
    const user = yield* getOptionalAppUserForRead();
    return user ? yield* guestsOf(user.appUser._id) : [];
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

/**
 * What the signed-in learner already holds of one try-out set's Stars, which its pane shows beside what
 * the set gives (ADR 0042, D8). None for a visitor.
 */
const claims = FunctionImpl.make(
  databaseSchema,
  spec,
  "claims",
  Effect.fn("island.queries.claims")(function* (keys) {
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
 * open both answer nothing. A learner with no island yet has counted nothing.
 */
const medals = FunctionImpl.make(
  databaseSchema,
  spec,
  "medals",
  Effect.fn("island.queries.medals")(function* ({ username }) {
    const owner = yield* getAppUserByUsername(username);
    if (!owner) {
      return null;
    }
    const viewer = yield* getOptionalAppUserForRead();
    const access = yield* profileAccess(owner._id, viewer?.appUser._id ?? null);
    if (!access.opens) {
      return null;
    }
    return Option.match(yield* findIsland(owner._id), {
      onNone: () => ({ level: 1, tally: EMPTY_TALLY }),
      onSome: (island) => ({
        level: growthOf(island.lifetime).level,
        tally: island.tally,
      }),
    });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(claims),
  Layer.provide(growth),
  Layer.provide(medals),
  Layer.provide(own),
  Layer.provide(region),
  Layer.provide(visit),
  Layer.provide(guests),
  Layer.provide(week),
  Layer.provide(leaders),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
