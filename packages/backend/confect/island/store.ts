import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { NO_MATERIALS } from "@repo/backend/confect/island/material";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DateTime, Effect, Option } from "effect";

/** The zone of an island made before its owner's browser told us theirs. */
const FIRST_ZONE = DateTime.zoneMakeNamedUnsafe("UTC");

/** The learner's island, none before their first grant or visit. */
export const findIsland = Effect.fn("island.store.find")(function* (
  userId: Id<"users">
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("islands")
    .index("by_userId", (query) => query.eq("userId", userId))
    .first()
    .pipe(Effect.orDie);
});

/**
 * The learner's island, made with the starter set when they have none yet. A
 * new island is private, starts in the given zone (UTC when a grant makes it
 * before the owner's first visit), and has earned nothing.
 */
export const ensureIsland = Effect.fn("island.store.ensure")(function* (
  userId: Id<"users">,
  timeZone: DateTime.TimeZone.Named = FIRST_ZONE
) {
  const found = yield* findIsland(userId);
  if (Option.isSome(found)) {
    return found.value;
  }
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const islandId = yield* writer
    .table("islands")
    .insert({
      badges: [],
      harvested: NO_MATERIALS,
      layout: STARTER_LAYOUT,
      lifetime: 0,
      timeZone,
      userId,
      version: 0,
      visibility: "private",
    })
    .pipe(Effect.orDie);
  return yield* database.table("islands").get(islandId).pipe(Effect.orDie);
});
