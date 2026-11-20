import { describe, expect, it } from "@effect/vitest";
import { grantAward } from "@repo/backend/confect/island/award";
import { bareChunk } from "@repo/backend/confect/island/chunk";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { inMutation } from "@repo/backend/test/client";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 10, 8, 3, 0, 0);

describe("auth/cleanup/island", () => {
  it.effect(
    "deletes a deleted account's chunks, guest book, stickers and ledger in batches, then its island, and keeps others'",
    () =>
      Effect.gen(function* () {
        vi.useFakeTimers({ now: NOW });
        const t = createConvexTestWithAuth();
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
        yield* Effect.promise(() =>
          t.run(async (ctx) => {
            for (const cx of Arr.range(0, 59)) {
              await ctx.db.insert("islandChunks", {
                ...bareChunk(),
                cx,
                cz: 0,
                rx: Math.floor(cx / 8),
                rz: 0,
                things: [{ at: 0, kind: "bush", turn: 0 }],
                userId: cx === 0 ? kept.userId : deleted.userId,
              });
            }
            // Each left a sticker in the other's guest book.
            await ctx.db.insert("islandGuests", {
              at: NOW,
              sticker: "wave",
              userId: deleted.userId,
              visitorId: kept.userId,
            });
            await ctx.db.insert("islandGuests", {
              at: NOW,
              sticker: "sun",
              userId: kept.userId,
              visitorId: deleted.userId,
            });
          })
        );
        const pages = yield* Effect.forEach(Arr.range(1, 8), () =>
          Effect.promise(() =>
            t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
              userId: deleted.userId,
            })
          )
        );
        // Chunks twice, the guest book, the stickers left, the ledger twice, the island.
        expect(pages).toEqual([
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          false,
        ]);
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            chunks: await ctx.db.query("islandChunks").collect(),
            grants: await ctx.db.query("islandAwards").collect(),
            guests: await ctx.db.query("islandGuests").collect(),
            islands: await ctx.db.query("islands").collect(),
          }))
        );
        expect(Arr.map(state.chunks, (chunk) => chunk.userId)).toEqual([
          kept.userId,
        ]);
        expect(state.guests).toEqual([]);
        expect(Arr.map(state.grants, (grant) => grant.userId)).toEqual([
          kept.userId,
        ]);
        expect(Arr.map(state.islands, (island) => island.userId)).toEqual([
          kept.userId,
        ]);
      })
  );
});
