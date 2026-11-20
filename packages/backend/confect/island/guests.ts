import type { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { leaderNameOf } from "@repo/backend/confect/island/leaders";
import type { Sticker } from "@repo/backend/confect/island/schema";
import { Array as Arr, Clock, Effect, Option } from "effect";

/** How many guests the owner reads, newest first. */
const GUEST_COUNT = 30;

/**
 * Leaves a visitor's sticker in a world's guest book (ADR 0050, W6). A visitor
 * holds one row in each world, so a second sticker replaces the first and
 * moves it to the top.
 */
export const leaveSticker = Effect.fn("island.guests.leave")(function* (
  userId: Id<"users">,
  visitorId: Id<"users">,
  sticker: typeof Sticker.Type
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const at = yield* Clock.currentTimeMillis;
  const held = yield* database
    .table("islandGuests")
    .index("by_userId_and_visitorId", (query) =>
      query.eq("userId", userId).eq("visitorId", visitorId)
    )
    .first()
    .pipe(Effect.orDie);
  yield* Option.match(held, {
    onNone: () =>
      writer.table("islandGuests").insert({ at, sticker, userId, visitorId }),
    onSome: (row) =>
      writer.table("islandGuests").patch(row._id, { at, sticker }),
  }).pipe(Effect.orDie);
});

/**
 * A world's newest guests for its owner, each by their first name and mascot.
 * A guest whose account is gone is left out.
 */
export const guestsOf = Effect.fn("island.guests.read")(function* (
  userId: Id<"users">
) {
  const database = yield* DatabaseReader;
  const rows = yield* database
    .table("islandGuests")
    .index("by_userId_and_at", (query) => query.eq("userId", userId), "desc")
    .take(GUEST_COUNT)
    .pipe(Effect.orDie);
  const guests = yield* Effect.forEach(rows, (row) =>
    database
      .table("users")
      .get(row.visitorId)
      .pipe(
        Effect.option,
        Effect.map(
          Option.map((visitor) => ({
            at: row.at,
            mascot: visitor.mascot,
            name: leaderNameOf(visitor.name),
            sticker: row.sticker,
          }))
        )
      )
  );
  return Arr.getSomes(guests);
});
