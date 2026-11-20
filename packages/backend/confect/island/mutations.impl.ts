import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { change } from "@repo/backend/confect/island/change";
import { leaveSticker } from "@repo/backend/confect/island/guests";
import spec from "@repo/backend/confect/island/mutations.spec";
import { Closed } from "@repo/backend/confect/island/schema";
import { ensureIsland } from "@repo/backend/confect/island/store";
import { openBlueprint } from "@repo/backend/confect/island/things";
import { worldOf } from "@repo/backend/confect/island/visit";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Clock, Effect, Layer, Option } from "effect";

/**
 * Called as the learner enters the game: makes their island when they have
 * none, keeps its zone at their browser's, so the island's day follows them
 * when they travel and the daily Stars count by their own day, and notes the
 * moment. Answers when they entered before this time, none on the first, so
 * the game shows who visited since (ADR 0050, W6).
 */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("island.mutations.open")(function* ({ timeZone }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id, timeZone);
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("islands")
      .patch(island._id, { entered: yield* Clock.currentTimeMillis, timeZone })
      .pipe(Effect.orDie);
    return { entered: island.entered ?? null };
  })
);

/**
 * Opens a blueprint for its price in Stars, once and for good (ADR 0050, W5).
 * The balance is read from the island's own row, so it cannot drift: the
 * lifetime Stars less the price of every blueprint opened.
 */
const unlock = FunctionImpl.make(
  databaseSchema,
  spec,
  "unlock",
  Effect.fn("island.mutations.unlock")(function* ({ kind }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    const held = island.blueprints ?? [];
    const opened = yield* Effect.fromResult(
      openBlueprint(island.lifetime, held, kind)
    );
    if (opened.blueprints !== held) {
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("islands")
        .patch(island._id, { blueprints: opened.blueprints })
        .pipe(Effect.orDie);
    }
    return opened;
  })
);

/** Sets who the learner's world opens to beside themselves (ADR 0050, W6). */
const share = FunctionImpl.make(
  databaseSchema,
  spec,
  "share",
  Effect.fn("island.mutations.share")(function* ({ access }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("islands")
      .patch(island._id, { access })
      .pipe(Effect.orDie);
    return null;
  })
);

/**
 * Leaves the signed-in visitor's sticker in the guest book of the world at an
 * address (ADR 0050, W6). A world that does not open to them, and their own,
 * take none.
 */
const greet = FunctionImpl.make(
  databaseSchema,
  spec,
  "greet",
  Effect.fn("island.mutations.greet")(function* ({ sticker, username }) {
    const { appUser } = yield* requireAuth();
    const world = yield* worldOf(username);
    if (Option.isNone(world) || world.value.own) {
      return yield* new Closed();
    }
    yield* leaveSticker(world.value.owner._id, appUser._id, sticker);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(change),
  Layer.provide(unlock),
  Layer.provide(share),
  Layer.provide(greet),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
