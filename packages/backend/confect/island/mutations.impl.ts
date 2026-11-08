import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { applyOperations } from "@repo/backend/confect/island/build";
import { paidFor } from "@repo/backend/confect/island/layout";
import { growthOf } from "@repo/backend/confect/island/level";
import spec from "@repo/backend/confect/island/mutations.spec";
import { IslandStale } from "@repo/backend/confect/island/schema";
import { ensureIsland } from "@repo/backend/confect/island/store";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

/**
 * Called by the owner's own visit: makes their island with the starter set when
 * they have none, and keeps its zone at their browser's, so the island's day
 * and hour follow them when they travel (ADR 0042, D18).
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

/** Sets who may visit the owner's island (ADR 0042, D6). */
const share = FunctionImpl.make(
  databaseSchema,
  spec,
  "share",
  Effect.fn("island.mutations.share")(function* ({ visibility }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    if (island.visibility !== visibility) {
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("islands")
        .patch(island._id, { visibility })
        .pipe(Effect.orDie);
    }
    return null;
  })
);

/**
 * Applies the owner's batch of changes to their island with the rules the
 * browser ran first (ADR 0042, D12), refusing a batch made against an older
 * layout or one the rules refuse, and writes the new layout under the next
 * version. The Stars it spent or returned are in what the placements paid.
 */
const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("island.mutations.edit")(function* ({ operations, version }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    if (island.version !== version) {
      return yield* new IslandStale({ version: island.version });
    }
    const growth = growthOf(island.lifetime);
    const edited = yield* Effect.fromResult(
      applyOperations(island.layout, operations, {
        level: growth.level,
        size: growth.size,
        stars: island.lifetime - paidFor(island.layout),
      })
    );
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("islands")
      .patch(island._id, { layout: edited.layout, version: version + 1 })
      .pipe(Effect.orDie);
    return { version: version + 1 };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(share),
  Layer.provide(edit),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
