import type { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { growthOf } from "@repo/backend/confect/island/level";
import { Array as Arr, Effect, Option, String as Str } from "effect";

/** How many learners the global leaderboard shows. */
export const LEADER_COUNT = 10;

/**
 * The global leaderboard (ADR 0047, D27): the learners with the most Stars
 * ever earned, most first, each by the first word of their name, their mascot
 * and their level, and whether the row is the viewer's own. A learner who has
 * earned nothing yet, or whose account is gone, is left out.
 */
export const leadersOf = Effect.fn("island.leaders")(function* (
  viewer: Option.Option<Id<"users">>
) {
  const database = yield* DatabaseReader;
  const islands = yield* database
    .table("islands")
    .index("by_lifetime", (query) => query.gt("lifetime", 0), "desc")
    .take(LEADER_COUNT)
    .pipe(Effect.orDie);
  const rows = yield* Effect.forEach(islands, (island) =>
    database
      .table("users")
      .get(island.userId)
      .pipe(
        Effect.option,
        Effect.map(
          Option.map((user) => ({
            level: growthOf(island.lifetime).level,
            lifetime: island.lifetime,
            mascot: user.mascot,
            name: Arr.headNonEmpty(Str.split(Str.trim(user.name), " ")),
            own: Option.exists(viewer, (id) => id === island.userId),
          }))
        )
      )
  );
  return Arr.map(Arr.getSomes(rows), (row, index) => ({
    ...row,
    place: index + 1,
  }));
});
