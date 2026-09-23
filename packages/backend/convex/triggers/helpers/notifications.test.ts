import { describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createNotification } from "@repo/backend/convex/triggers/helpers/notifications";
import { createClassFixture } from "@repo/backend/test/classes";
import { convexTest } from "convex-test";

describe("triggers/helpers/notifications", () => {
  it("does not recreate notification data for a deletion-pending recipient", async () => {
    const t = convexTest(schema, convexModules);
    const recipientId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "prepared-notification-recipient",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: Date.now(),
        email: "prepared-notification-recipient@example.com",
        name: "Prepared notification recipient",
        plan: "free",
      })
    );

    await t.mutation((ctx) =>
      createNotification(ctx, {
        entityType: "system",
        previewTitle: "Ignored notification",
        recipientId,
        type: "system",
      })
    );

    const state = await t.query(async (ctx) => ({
      counts: await ctx.db.query("notificationCounts").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));

    expect(state).toEqual({
      counts: [],
      notifications: [],
    });
  });
});

it.each(["allowed", "disabled", "muted", "missing"])(
  "respects %s notification delivery while preserving unread counts",
  async (mode) => {
    const { t, users, classId } = await createClassFixture();
    const recipientId = users.outsider.userId;
    await t.mutation(async (ctx) => {
      if (mode === "missing") {
        await ctx.db.delete("users", recipientId);
      }
      if (mode === "disabled") {
        await ctx.db.insert("notificationPreferences", {
          userId: recipientId,
          disabledTypes: ["class_announcement"],
          emailEnabled: false,
          emailDigest: "never",
          updatedAt: 0,
        });
      }
      if (mode === "muted") {
        await ctx.db.insert("notificationEntityMutes", {
          userId: recipientId,
          entityType: "schoolClasses",
          entityId: classId,
          mutedAt: 0,
        });
      }
      const args = {
        recipientId,
        entityType: "schoolClasses",
        entityId: classId,
        type: "class_announcement",
      } as const;
      await createNotification(ctx, args);
      await createNotification(ctx, {
        ...args,
        actorId: users.admin.userId,
        previewBody: "New lesson",
        previewTitle: "Class update",
      });
      if (mode === "allowed") {
        await createNotification(ctx, {
          ...args,
          entityType: "system",
          type: "system",
        });
      }
    });
    const state = await t.query(async (ctx) => ({
      count: await ctx.db
        .query("notificationCounts")
        .withIndex("by_userId", (q) => q.eq("userId", recipientId))
        .unique(),
      notifications: await ctx.db
        .query("notifications")
        .withIndex("by_recipientId", (q) => q.eq("recipientId", recipientId))
        .collect(),
    }));
    if (mode === "allowed") {
      expect(state.count?.unreadCount).toBe(3);
      expect(state.notifications).toHaveLength(3);
      expect(state.notifications[0]).not.toHaveProperty("actorId");
      expect(state.notifications[0]).not.toHaveProperty("previewTitle");
      expect(state.notifications[1]).toMatchObject({
        actorId: users.admin.userId,
        previewBody: "New lesson",
      });
    } else {
      expect(state.count).toBeNull();
      expect(state.notifications).toEqual([]);
    }
  }
);
