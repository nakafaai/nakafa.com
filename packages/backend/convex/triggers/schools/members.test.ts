import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 20, 30, 0);

describe("triggers/schools/members", () => {
  afterEach(() => {
    vi.useRealTimers();
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
