import { describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 9, 10, 8, 0, 0);

describe("bookmarks/purge", () => {
  it.effect(
    "deletes the rows of both retired tables and reports zero once they are empty",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        yield* Effect.promise(() =>
          test.run(async (ctx) => {
            const userId = await ctx.db.insert("users", {
              authId: "auth-bookmarks",
              credits: 10,
              creditsResetAt: NOW,
              email: "saved@example.com",
              name: "Saved User",
              plan: "free",
            });
            const collectionId = await ctx.db.insert("bookmarkCollections", {
              bookmarkCount: 1,
              image: "default",
              isDefault: true,
              isPublic: false,
              name: "Saved",
              order: 0,
              updatedAt: NOW,
              userId,
            });
            await ctx.db.insert("bookmarks", {
              bookmarkedAt: NOW,
              collectionId,
              order: 0,
              slug: "material/algebra",
              userId,
            });
            await ctx.db.insert("bookmarks", {
              bookmarkedAt: NOW,
              order: 1,
              slug: "material/geometry",
              userId,
            });
          })
        );

        const first = yield* Effect.promise(() =>
          test.mutation(internal.bookmarks.purge.purgeBookmarks, {})
        );
        expect(first).toEqual({ bookmarks: 2, collections: 1 });

        const second = yield* Effect.promise(() =>
          test.mutation(internal.bookmarks.purge.purgeBookmarks, {})
        );
        expect(second).toEqual({ bookmarks: 0, collections: 0 });

        const remaining = yield* Effect.promise(() =>
          test.run(async (ctx) => ({
            bookmarks: await ctx.db.query("bookmarks").take(5),
            collections: await ctx.db.query("bookmarkCollections").take(5),
            users: await ctx.db.query("users").take(5),
          }))
        );
        expect(remaining.bookmarks).toEqual([]);
        expect(remaining.collections).toEqual([]);
        expect(remaining.users).toHaveLength(1);
      })
  );
});
