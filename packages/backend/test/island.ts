import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { Effect } from "effect";

/** The moment every island test starts at. */
export const ISLAND_NOW = Date.UTC(2026, 10, 8, 3, 0, 0);

/**
 * The test backend with two learners and a caller who is signed out: Ayu, who
 * holds the address `ayu`, and Budi, who visits.
 */
export const islandWorld = Effect.fn("test.island.world")(function* () {
  vi.useFakeTimers({ now: ISLAND_NOW });
  const t = createConvexTestWithAuth();
  const seeded = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const ayu = await seedAuthenticatedUser(ctx, {
        name: "Ayu Lestari",
        now: ISLAND_NOW,
        suffix: "ayu",
      });
      await ctx.db.patch("users", ayu.userId, { username: "ayu" });
      const budi = await seedAuthenticatedUser(ctx, {
        name: "Budi Santoso",
        now: ISLAND_NOW,
        suffix: "budi",
      });
      return { ayu, budi };
    })
  );
  return {
    anyone: client(t),
    owner: client(t.withIdentity({ subject: seeded.ayu.sessionId })),
    ownerId: seeded.ayu.userId,
    t,
    visitor: client(t.withIdentity({ subject: seeded.budi.sessionId })),
    visitorId: seeded.budi.userId,
  };
});
