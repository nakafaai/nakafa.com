import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { buildEdits } from "@repo/backend/confect/island/build";
import { growthOf } from "@repo/backend/confect/island/level";
import spec from "@repo/backend/confect/island/mutations.spec";
import { IslandStale } from "@repo/backend/confect/island/schema";
import { ensureIsland } from "@repo/backend/confect/island/store";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

/**
 * Called as the learner enters the game: makes their island when they have
 * none, and keeps its zone at their browser's, so the island's day follows
 * them when they travel and the daily Stars count by their own day.
 */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("island.mutations.open")(function* ({ timeZone }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id, timeZone);
    if (island.timeZone.id !== timeZone.id) {
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("islands")
        .patch(island._id, { timeZone })
        .pipe(Effect.orDie);
    }
    return null;
  })
);

/**
 * Builds a batch of the learner's edits with the rules the browser ran first
 * (ADR 0047, D6): a batch made against older edits is refused as stale, a
 * batch the rules refuse is refused whole, and otherwise the merged edits are
 * written under the next version. Building spends nothing.
 */
const build = FunctionImpl.make(
  databaseSchema,
  spec,
  "build",
  Effect.fn("island.mutations.build")(function* ({ edits, version }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    if (island.version !== version) {
      return yield* new IslandStale({ version: island.version });
    }
    const growth = growthOf(island.lifetime);
    const world = yield* Effect.fromResult(
      buildEdits(island.world, edits, growth.level, growth.size)
    );
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("islands")
      .patch(island._id, { version: version + 1, world })
      .pipe(Effect.orDie);
    return { version: version + 1 };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(build),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
