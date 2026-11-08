import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/island/mutations.spec";
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

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(share),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
