import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { growthOf } from "@repo/backend/confect/progress/level";
import { profileAccess } from "@repo/backend/confect/users/profile";
import { Array as Arr, Effect, Option, String as Str } from "effect";

/** The word a learner is named by to others: the first of their name, so no board shows a full name. */
function leaderNameOf(name: string) {
  return Arr.headNonEmpty(Str.split(Str.trim(name), " "));
}

/** How many learners the global leaderboard shows. */
export const LEADER_COUNT = 10;

/**
 * The public identity of a learner on a leaderboard: their mascot, first name,
 * whether the row is the viewer's own, and their profile username when the
 * viewer may open their profile (ADR 0009, Who Opens A Profile).
 */
export const leaderIdentityOf = Effect.fn("progress.leaders.identity")(
  function* (
    user: Pick<Docs["users"], "_id" | "mascot" | "name" | "username">,
    viewer: Option.Option<Id<"users">>
  ) {
    const viewerId = Option.getOrNull(viewer);
    const access = yield* profileAccess(user._id, viewerId);
    return {
      mascot: user.mascot,
      name: leaderNameOf(user.name),
      own: viewerId === user._id,
      username: access.opens ? (user.username ?? null) : null,
    };
  }
);

/**
 * The global leaderboard: the learners with the most Stars ever earned, most
 * first, each by the first word of their name, their mascot, their level, their
 * clickable profile username when accessible, and whether the row is the
 * viewer's own. A learner who has earned nothing yet, or whose account is gone,
 * is left out.
 */
export const leadersOf = Effect.fn("progress.leaders")(function* (
  viewer: Option.Option<Id<"users">>
) {
  const database = yield* DatabaseReader;
  const records = yield* database
    .table("progress")
    .index("by_lifetime", (query) => query.gt("lifetime", 0), "desc")
    .take(LEADER_COUNT)
    .pipe(Effect.orDie);
  const rows = yield* Effect.forEach(records, (record) =>
    database
      .table("users")
      .get(record.userId)
      .pipe(
        Effect.flatMap((user) =>
          leaderIdentityOf(user, viewer).pipe(
            Effect.map((identity) => ({
              ...identity,
              level: growthOf(record.lifetime).level,
              lifetime: record.lifetime,
            }))
          )
        ),
        Effect.option
      )
  );
  return Arr.map(Arr.getSomes(rows), (row, index) => ({
    ...row,
    place: index + 1,
  }));
});
