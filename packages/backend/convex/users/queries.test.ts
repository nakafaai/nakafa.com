import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("users/queries", () => {
  it("loads users by id and auth id", async () => {
    const t = convexTest(schema, convexModules);

    const { deletedUserId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth_user_real_example",
        email: "nabil@example.com",
        name: "Nabil Fatih",
        plan: "free",
        credits: 7,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });

      const deletedUserId = await ctx.db.insert("users", {
        authId: "deleted_auth_user",
        email: "deleted@example.com",
        name: "Deleted User",
        plan: "free",
        credits: 7,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });

      await ctx.db.delete("users", deletedUserId);

      return { deletedUserId, userId };
    });

    const [byId, byAuthId, missingById, missingByAuthId] = await Promise.all([
      t.query(internal.users.queries.getUserById, { userId }),
      t.query(internal.users.queries.getUserByAuthId, {
        authId: "auth_user_real_example",
      }),
      t.query(internal.users.queries.getUserById, {
        userId: deletedUserId,
      }),
      t.query(internal.users.queries.getUserByAuthId, {
        authId: "missing_auth_user",
      }),
    ]);

    expect(byId?._id).toBe(userId);
    expect(byAuthId?._id).toBe(userId);
    expect(missingById).toBeNull();
    expect(missingByAuthId).toBeNull();
  });
});
