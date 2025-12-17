import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

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
        skipped += 1;
        continue;
      }

      // Create app user
      await ctx.db.insert("users", {
        email: authUser.email,
        authId: authUser._id,
      });

      created += 1;
    }

    return { created, skipped, total: authUsers.page.length };
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
        skipped += 1;
        continue;
      }

      // Set userId in Better Auth user
      await ctx.runMutation(components.betterAuth.auth.setUserId, {
        authId: appUser.authId,
        userId: appUser._id,
      });

      updated += 1;
    }

    return { updated, skipped, total: appUsers.length };
  },
});

// Migration to convert comments userId from Better Auth ID to app user ID
export const migrationConvertCommentsUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const comments = await ctx.db.query("comments").collect();

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const comment of comments) {
      // Find the app user by authId (the current userId is actually the authId)
      const appUser = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", comment.userId as string))
        .unique();

      if (!appUser) {
        notFound += 1;
        continue;
      }

      // Check if it's already converted (would be a valid user ID)
      try {
        const existingUser = await ctx.db.get(
          "users",
          comment.userId as Id<"users">
        );
        if (existingUser) {
          skipped += 1;
          continue;
        }
      } catch {
        // Not a valid ID, needs conversion
      }

      // Update the comment with the app user ID
      await ctx.db.patch("comments", comment._id, {
        userId: appUser._id,
      });

      updated += 1;
    }

    return { updated, skipped, notFound, total: comments.length };
  },
});

// Migration to convert commentVotes userId from Better Auth ID to app user ID
export const migrationConvertCommentVotesUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const votes = await ctx.db.query("commentVotes").collect();

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const vote of votes) {
      // Find the app user by authId (the current userId is actually the authId)
      const appUser = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", vote.userId as string))
        .unique();

      if (!appUser) {
        notFound += 1;
        continue;
      }

      // Check if it's already converted (would be a valid user ID)
      try {
        const existingUser = await ctx.db.get(
          "users",
          vote.userId as Id<"users">
        );
        if (existingUser) {
          skipped += 1;
          continue;
        }
      } catch {
        // Not a valid ID, needs conversion
      }

      // Update the vote with the app user ID
      await ctx.db.patch("commentVotes", vote._id, {
        userId: appUser._id,
      });

      updated += 1;
    }

    return { updated, skipped, notFound, total: votes.length };
  },
});

// Migration to convert chats userId from Better Auth ID to app user ID
export const migrationConvertChatsUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const chats = await ctx.db.query("chats").collect();

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const chat of chats) {
      if (!chat.userId) {
        skipped += 1;
        continue;
      }

      // Find the app user by authId (the current userId is actually the authId)
      const appUser = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", chat.userId as string))
        .unique();

      if (!appUser) {
        notFound += 1;
        continue;
      }

      // Check if it's already converted (would be a valid user ID)
      try {
        const existingUser = await ctx.db.get(
          "users",
          chat.userId as Id<"users">
        );
        if (existingUser) {
          skipped += 1;
          continue;
        }
      } catch {
        // Not a valid ID, needs conversion
      }

      // Update the chat with the app user ID
      await ctx.db.patch("chats", chat._id, {
        userId: appUser._id,
      });

      updated += 1;
    }

    return { updated, skipped, notFound, total: chats.length };
  },
});

// Migration to backfill notification preferences for existing users
export const migrationBackfillNotificationPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if preferences already exist
      const existingPrefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .unique();

      if (existingPrefs) {
        skipped += 1;
        continue;
      }

      // Create default notification preferences
      await ctx.db.insert("notificationPreferences", {
        userId: user._id,
        emailEnabled: true,
        emailDigest: "weekly",
        disabledTypes: [],
        mutedEntities: [],
        updatedAt: Date.now(),
      });

      created += 1;
    }

    return { created, skipped, total: users.length };
  },
});
