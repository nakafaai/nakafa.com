import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createNotification } from "@repo/backend/convex/triggers/helpers/notifications";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

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
