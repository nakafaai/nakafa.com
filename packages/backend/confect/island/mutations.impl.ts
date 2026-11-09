import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { applyOperations } from "@repo/backend/confect/island/build";
import { todayOf } from "@repo/backend/confect/island/day";
import { harvestAt, waterPlants } from "@repo/backend/confect/island/farm";
import { growthOf } from "@repo/backend/confect/island/level";
import { addMaterials } from "@repo/backend/confect/island/material";
import spec from "@repo/backend/confect/island/mutations.spec";
import { FarmRefused, IslandStale } from "@repo/backend/confect/island/schema";
import {
  keepSnapshot as keepIslandSnapshot,
  reserveSnapshot as reserveIslandSnapshot,
} from "@repo/backend/confect/island/snapshot";
import { ensureIsland } from "@repo/backend/confect/island/store";
import { spendableOf } from "@repo/backend/confect/island/view";
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
        ...spendableOf(island),
        level: growth.level,
        size: growth.size,
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

/**
 * Waters every plant of the owner's island, once a day and only on a day they
 * learned (ADR 0042, D13), so the garden grows with learning and never instead
 * of it.
 */
const water = FunctionImpl.make(
  databaseSchema,
  spec,
  "water",
  Effect.fn("island.mutations.water")(function* ({ version }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    if (island.version !== version) {
      return yield* new IslandStale({ version: island.version });
    }
    const today = yield* todayOf(island.timeZone);
    if (island.learned !== today) {
      return yield* new FarmRefused({ reason: "unlearned" });
    }
    if (island.watered === today) {
      return yield* new FarmRefused({ reason: "watered" });
    }
    const layout = yield* Effect.fromOption(waterPlants(island.layout)).pipe(
      Effect.mapError(() => new FarmRefused({ reason: "barren" }))
    );
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("islands")
      .patch(island._id, { layout, version: version + 1, watered: today })
      .pipe(Effect.orDie);
    return { version: version + 1 };
  })
);

/** Harvests one grown plant of the owner's island into materials, never Stars (ADR 0042, D13). */
const harvest = FunctionImpl.make(
  databaseSchema,
  spec,
  "harvest",
  Effect.fn("island.mutations.harvest")(function* ({ at, version }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    if (island.version !== version) {
      return yield* new IslandStale({ version: island.version });
    }
    const harvested = yield* Effect.fromResult(harvestAt(island.layout, at));
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("islands")
      .patch(island._id, {
        harvested: addMaterials(island.harvested, harvested.yields),
        layout: harvested.layout,
        version: version + 1,
      })
      .pipe(Effect.orDie);
    return { version: version + 1 };
  })
);

/**
 * Reserves the bytes of a new picture of the owner's island, taken as they
 * share it, and answers the R2 address the browser uploads it to (ADR 0042, D20).
 */
const reserveSnapshot = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserveSnapshot",
  Effect.fn("island.mutations.reserveSnapshot")(function* ({ byteSize }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    return yield* reserveIslandSnapshot(island, byteSize);
  })
);

/** Keeps the uploaded picture as the island's snapshot, a visit's OpenGraph image (ADR 0042, D20). */
const keepSnapshot = FunctionImpl.make(
  databaseSchema,
  spec,
  "keepSnapshot",
  Effect.fn("island.mutations.keepSnapshot")(function* ({ fileId }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    yield* keepIslandSnapshot(island, fileId);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(share),
  Layer.provide(edit),
  Layer.provide(water),
  Layer.provide(harvest),
  Layer.provide(reserveSnapshot),
  Layer.provide(keepSnapshot),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
