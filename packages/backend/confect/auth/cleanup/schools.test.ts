import { expect, it } from "@effect/vitest";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";
import { Array as Arr } from "effect";

it("removes memberships before all account-linked activity while preserving other members", async () => {
  const { t, admin, student, users, schoolId, classId } =
    await createClassFixture();
  await admin.mutation(api.classes.mutations.updateClassVisibility, {
    classId,
    visibility: "public",
  });
  await student.mutation(api.classes.mutations.joinPublicClass, { classId });
  const userId = users.student.userId;
  const otherId = users.admin.userId;
  const logs = await t.mutation(async (ctx) => {
    const shared = { schoolId, entityId: "account-reference", userId: otherId };
    const invited = await ctx.db.insert("schoolActivityLogs", {
      ...shared,
      action: "member_invited",
      entityType: "schoolMembers",
      metadata: { invitedUserId: userId, role: "student" },
    });
    const added = await ctx.db.insert("schoolActivityLogs", {
      ...shared,
      action: "class_member_added",
      entityType: "schoolClassMembers",
      metadata: { classId, addedUserId: userId, role: "student" },
    });
    const removed = await ctx.db.insert("schoolActivityLogs", {
      ...shared,
      action: "member_removed",
      entityType: "schoolMembers",
      metadata: { removedUserId: userId, role: "student" },
    });
    const actor = await ctx.db.insert("schoolActivityLogs", {
      ...shared,
      userId,
      action: "school_created",
      entityType: "schools",
      metadata: { schoolName: "Retained School" },
    });
    const retained = await ctx.db.insert("schoolActivityLogs", {
      ...shared,
      action: "school_created",
      entityType: "schools",
      metadata: { schoolName: "Retained School" },
    });
    return { deleted: [invited, added, removed, actor], retained };
  });
  expect(
    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId })
  ).toBe(true);
  const first = await t.query(async (ctx) => ({
    classes: await ctx.db
      .query("schoolClassMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect(),
    schools: await ctx.db
      .query("schoolMembers")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", userId))
      .collect(),
  }));
  expect(first.classes).toEqual([]);
  expect(first.schools).toHaveLength(1);
  let hasMore = true;
  for (let pass = 0; hasMore && pass < 12; pass += 1) {
    hasMore = await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId,
    });
  }
  expect(hasMore).toBe(false);
  const state = await t.query(async (ctx) => ({
    deletedLogs: await Promise.all(
      Arr.map(logs.deleted, (id) => ctx.db.get("schoolActivityLogs", id))
    ),
    retainedLog: await ctx.db.get("schoolActivityLogs", logs.retained),
    classes: await ctx.db.query("schoolClassMembers").collect(),
    schools: await ctx.db.query("schoolMembers").collect(),
    school: await ctx.db.get("schools", schoolId),
    class: await ctx.db.get("schoolClasses", classId),
  }));
  expect(state.deletedLogs).toEqual([null, null, null, null]);
  expect(state.retainedLog).toMatchObject({ userId: otherId });
  expect(state.classes).toEqual([expect.objectContaining({ userId: otherId })]);
  expect(state.schools).toEqual([expect.objectContaining({ userId: otherId })]);
  expect(state.school).not.toBeNull();
  expect(state.class).not.toBeNull();
});
