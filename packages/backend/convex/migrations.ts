import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { authComponent } from "./auth";

// Migration to create app users from Better Auth users
export const migrationCreateAppUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all Better Auth users
    const authUsers = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      {
        model: "user",
        paginationOpts: {
          cursor: null,
          numItems: 1000,
        },
      }
    );

    let created = 0;
    let skipped = 0;

    for (const authUser of authUsers.page) {
      // Check if app user already exists with this authId
      const existingUser = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", authUser._id))
        .unique();

      if (existingUser) {
        skipped++;
        continue;
      }

      // Create app user
      await ctx.db.insert("users", {
        email: authUser.email,
        authId: authUser._id,
      });

      created++;
    }

    return { created, skipped, total: authUsers.page.length };
  },
});

// Migration to remove userId from Better Auth users
export const migrationRemoveUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all app users
    const appUsers = await ctx.db.query("users").collect();

    let updated = 0;

    for (const appUser of appUsers) {
      if (!appUser.authId) {
        continue;
      }

      // Remove userId from Better Auth user using the authId
      await authComponent.migrationRemoveUserId(ctx, appUser.authId);
      updated++;
    }

    return { updated, total: appUsers.length };
  },
});

// Migration to populate userId field in Better Auth users
export const migrationAddUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all app users
    const appUsers = await ctx.db.query("users").collect();

    let updated = 0;
    let skipped = 0;

    for (const appUser of appUsers) {
      if (!appUser.authId) {
        continue;
      }

      // Get the Better Auth user
      const authUser = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        {
          model: "user",
          where: [
            {
              field: "_id",
              value: appUser.authId,
              operator: "eq",
            },
          ],
        }
      );

      if (!authUser) {
        continue;
      }

      // Skip if userId is already set
      if (authUser.userId) {
        skipped++;
        continue;
      }

      // Set userId in Better Auth user
      await ctx.runMutation(components.betterAuth.auth.setUserId, {
        authId: appUser.authId,
        userId: appUser._id,
      });

      updated++;
    }

    return { updated, skipped, total: appUsers.length };
  },
});
