import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  insertClass,
  insertSchool,
  NOW,
} from "@repo/backend/convex/assessments/seed";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

describe("classes/materials/mutations", () => {
  it("clears schedule fields when a scheduled material is published", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "materials-publish-teacher",
      });
      const schoolId = await insertSchool(ctx, teacher.userId);
      const classId = await insertClass(ctx, schoolId, teacher.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: teacher.userId,
        role: "admin",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: teacher.userId,
        role: "teacher",
        teacherRole: "primary",
        updatedAt: NOW,
      });

      return { classId, teacher };
    });

    const teacherClient = t.withIdentity({
      subject: seeded.teacher.authUserId,
      sessionId: seeded.teacher.sessionId,
    });

    const groupId = await teacherClient.mutation(
      api.classes.materials.mutations.createMaterialGroup,
      {
        classId: seeded.classId,
        name: "Scheduled Material",
        description: "Description",
        status: "scheduled",
        scheduledAt: NOW + 60_000,
      }
    );

    vi.setSystemTime(new Date(NOW + 1000));

    await t.mutation(async (ctx) => {
      await ctx.runMutation(
        internal.classes.materials.mutations.publishMaterialGroup,
        {
          groupId,
          publishedBy: seeded.teacher.userId,
        }
      );
    });

    const group = await t.query(async (ctx) => {
      return await ctx.db.get("schoolClassMaterialGroups", groupId);
    });

    expect(group?.status).toBe("published");
    expect(group?.scheduledAt).toBeUndefined();
    expect(group?.scheduledJobId).toBeUndefined();
    expect(group?.publishedAt).toBe(NOW + 1000);
    expect(group?.publishedBy).toBe(seeded.teacher.userId);
  });

  it("cancels the pending publish job before deleting a scheduled material", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "materials-delete-teacher",
      });
      const schoolId = await insertSchool(ctx, teacher.userId);
      const classId = await insertClass(ctx, schoolId, teacher.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: teacher.userId,
        role: "admin",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: teacher.userId,
        role: "teacher",
        teacherRole: "primary",
        updatedAt: NOW,
      });

      return { classId, teacher };
    });

    const teacherClient = t.withIdentity({
      subject: seeded.teacher.authUserId,
      sessionId: seeded.teacher.sessionId,
    });

    const groupId = await teacherClient.mutation(
      api.classes.materials.mutations.createMaterialGroup,
      {
        classId: seeded.classId,
        name: "Delete Scheduled Material",
        description: "Description",
        status: "scheduled",
        scheduledAt: NOW + 60_000,
      }
    );

    const scheduledJobId = await t.query(async (ctx) => {
      const group = await ctx.db.get("schoolClassMaterialGroups", groupId);

      return group?.scheduledJobId;
    });

    if (!scheduledJobId) {
      throw new Error("Expected scheduled material job id.");
    }

    await teacherClient.mutation(
      api.classes.materials.mutations.deleteMaterialGroup,
      {
        groupId,
      }
    );

    const deletedState = await t.query(async (ctx) => {
      return {
        group: await ctx.db.get("schoolClassMaterialGroups", groupId),
        scheduledJob: await ctx.db.system.get(
          "_scheduled_functions",
          scheduledJobId
        ),
      };
    });

    expect(deletedState.group).toBeNull();
    expect(deletedState.scheduledJob?.state).toEqual(
      expect.objectContaining({ kind: "canceled" })
    );
  });
});
