import { describe, expect, it } from "@effect/vitest";
import { grantAward } from "@repo/backend/confect/island/award";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { inMutation } from "@repo/backend/test/client";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 10, 8, 3, 0, 0);

describe("auth/cleanup/island", () => {
  it.effect(
    "deletes a deleted account's ledger in batches, then its island, and keeps others'",
    () =>
      Effect.gen(function* () {
        vi.useFakeTimers({ now: NOW });
        const t = createConvexTestWithBetterAuth();
        const { deleted, kept } = yield* Effect.promise(() =>
          t.mutation(async (ctx) => ({
            deleted: await seedAuthenticatedUser(ctx, {
              now: NOW,
              suffix: "deleted",
            }),
            kept: await seedAuthenticatedUser(ctx, {
              now: NOW,
              suffix: "kept",
            }),
          }))
        );
        for (const day of Arr.range(0, 59)) {
          vi.setSystemTime(NOW + day * 86_400_000);
          yield* Effect.promise(() =>
            t.run(
              inMutation(() =>
                grantAward(deleted.userId, { _tag: "set", set: `set-${day}` })
              )
            )
          );
        }
        yield* Effect.promise(() =>
          t.run(
            inMutation(() =>
              grantAward(kept.userId, { _tag: "set", set: "set-kept" })
            )
          )
        );
        const pages = yield* Effect.forEach(Arr.range(1, 4), () =>
          Effect.promise(() =>
            t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
              userId: deleted.userId,
            })
          )
        );
        expect(pages).toEqual([true, true, true, false]);
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            grants: await ctx.db.query("islandAwards").collect(),
            islands: await ctx.db.query("islands").collect(),
          }))
        );
        expect(Arr.map(state.grants, (grant) => grant.userId)).toEqual([
          kept.userId,
        ]);
        expect(Arr.map(state.islands, (island) => island.userId)).toEqual([
          kept.userId,
        ]);
      })
  );
});
