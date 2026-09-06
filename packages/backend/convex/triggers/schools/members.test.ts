import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { schoolMembersHandler } from "@repo/backend/convex/triggers/schools/members";
import { createClassFixture } from "@repo/backend/test/classes";

const NOW = Date.UTC(2026, 4, 29, 20, 30, 0);

describe("triggers/schools/members", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([true, false])(
    "records invitation and removal actors when an explicit actor is %s",
    async (hasActor) => {
      const { t, users, schoolId } = await createClassFixture();
      const memberId = await t.mutation(async (ctx) => {
        const id = await ctx.db.insert("schoolMembers", {
          userId: users.student.userId,
          schoolId,
          role: "student",
          status: "invited",
          joinedAt: NOW,
          updatedAt: NOW,
          invitedAt: NOW,
          invitedBy: hasActor ? users.admin.userId : undefined,
        });
        const invited = await ctx.db.get("schoolMembers", id);
        assert(invited);
        await schoolMembersHandler(ctx, {
          id,
          operation: "insert",
          oldDoc: null,
          newDoc: invited,
        });
        await ctx.db.patch("schoolMembers", id, {
          role: "teacher",
          status: "active",
        });
        const joined = await ctx.db.get("schoolMembers", id);
        assert(joined);
        await schoolMembersHandler(ctx, {
          id,
          operation: "update",
          oldDoc: invited,
          newDoc: joined,
        });
        await schoolMembersHandler(ctx, {
          id,
          operation: "update",
          oldDoc: joined,
          newDoc: joined,
        });
        await ctx.db.patch("schoolMembers", id, {
          status: "removed",
          removedAt: NOW,
          removedBy: hasActor ? users.admin.userId : undefined,
        });
        const removed = await ctx.db.get("schoolMembers", id);
        assert(removed);
        await schoolMembersHandler(ctx, {
          id,
          operation: "update",
          oldDoc: joined,
          newDoc: removed,
        });
        await schoolMembersHandler(ctx, {
          id,
          operation: "update",
          oldDoc: removed,
          newDoc: removed,
        });
        await ctx.db.delete("schoolMembers", id);
        await schoolMembersHandler(ctx, {
          id,
          operation: "delete",
          oldDoc: removed,
          newDoc: null,
        });
        return id;
      });
      const logs = await t.query((ctx) =>
        ctx.db.query("schoolActivityLogs").collect()
      );
      const memberLogs = logs.filter((log) => log.entityId === memberId);
      expect(memberLogs.map(({ action }) => action)).toEqual([
        "member_invited",
        "member_role_changed",
        "member_joined",
        "member_removed",
        "member_removed",
      ]);
      expect(memberLogs[0].userId).toBe(
        hasActor ? users.admin.userId : users.student.userId
      );
      expect(memberLogs[3].userId).toBe(
        hasActor ? users.admin.userId : users.student.userId
      );
      expect(memberLogs[4].userId).toBe(users.student.userId);
    }
  );

  it("does not log removed inserts and tolerates deleted invite codes", async () => {
    const { t, users, schoolId } = await createClassFixture();
    const memberId = await t.mutation(async (ctx) => {
      const invite = await ctx.db.query("schoolInviteCodes").first();
      assert(invite);
      await ctx.db.delete("schoolInviteCodes", invite._id);
      const id = await ctx.db.insert("schoolMembers", {
        userId: users.student.userId,
        schoolId,
        role: "student",
        status: "removed",
        joinedAt: NOW,
        updatedAt: NOW,
        inviteCodeId: invite._id,
      });
      const member = await ctx.db.get("schoolMembers", id);
      assert(member);
      await schoolMembersHandler(ctx, {
        id,
        operation: "insert",
        oldDoc: null,
        newDoc: member,
      });
      return id;
    });
    const logs = await t.query((ctx) =>
      ctx.db.query("schoolActivityLogs").collect()
    );
    expect(logs.some((log) => log.entityId === memberId)).toBe(false);
  });

  it("tracks school joins and invite usage through school mutations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const users = await t.mutation(async (ctx) => ({
      admin: await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "school-admin",
      }),
      student: await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-school-student",
        suffix: "school-student",
      }),
    }));
    const admin = t.withIdentity({
      sessionId: users.admin.sessionId,
      subject: users.admin.authUserId,
    });
    const student = t.withIdentity({
      sessionId: users.student.sessionId,
      subject: users.student.authUserId,
    });

    const created = await admin.mutation(api.schools.mutations.createSchool, {
      address: "Jl. Merdeka 1",
      city: "Jakarta",
      email: "school-trigger@example.com",
      name: "Trigger School",
      phone: "021-123456",
      province: "DKI Jakarta",
      type: "high-school",
    });

    const inviteCode = await t.query(async (ctx) => {
      const inviteCodes = await ctx.db.query("schoolInviteCodes").collect();
      return (
        inviteCodes.find(
          (code) =>
            code.schoolId === created.schoolId && code.role === "student"
        ) ?? null
      );
    });

    expect(inviteCode).toMatchObject({
      currentUsage: 0,
      role: "student",
    });
    if (!inviteCode) {
      throw new Error("Student invite code was not created.");
    }

    await student.mutation(api.schools.mutations.joinSchool, {
      code: inviteCode.code,
    });

    const state = await t.query(async (ctx) => {
      const logs = await ctx.db
        .query("schoolActivityLogs")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", created.schoolId))
        .collect();
      const member = await ctx.db
        .query("schoolMembers")
        .withIndex("by_schoolId_and_userId_and_status", (q) =>
          q
            .eq("schoolId", created.schoolId)
            .eq("userId", users.student.userId)
            .eq("status", "active")
        )
        .unique();

      return {
        inviteCode: inviteCode
          ? await ctx.db.get("schoolInviteCodes", inviteCode._id)
          : null,
        logs,
        member,
      };
    });

    expect(state.inviteCode).toMatchObject({ currentUsage: 1 });
    expect(state.member).toMatchObject({
      inviteCodeId: inviteCode?._id,
      role: "student",
      schoolId: created.schoolId,
      userId: users.student.userId,
    });
    expect(state.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "school_created",
          entityId: created.schoolId,
          entityType: "schools",
          userId: users.admin.userId,
        }),
        expect.objectContaining({
          action: "member_joined",
          entityType: "schoolMembers",
          metadata: expect.objectContaining({
            joinedAt: NOW,
            role: "admin",
          }),
          userId: users.admin.userId,
        }),
        expect.objectContaining({
          action: "member_joined",
          entityType: "schoolMembers",
          metadata: expect.objectContaining({
            joinedAt: NOW,
            role: "student",
          }),
          userId: users.student.userId,
        }),
      ])
    );
  });
});
