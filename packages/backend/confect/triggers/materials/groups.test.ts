import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/confect/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";
import { Struct } from "effect";

const NOW = Date.UTC(2026, 3, 16, 14, 0, 0);

describe("triggers/materials/groups", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes a group tree across bounded continuation jobs", async () => {
    vi.useFakeTimers();
    const { t, admin, classId } = await createClassFixture();
    const groupId = await admin.mutation(
      api.classes.materials.mutations.createMaterialGroup,
      {
        classId,
        description: "Batched deletion",
        name: "Batched deletion",
        status: "published",
      }
    );
    await t.mutation(async (ctx) => {
      const group = await ctx.db.get("schoolClassMaterialGroups", groupId);
      assert(group);
      for (let index = 0; index < 26; index += 1) {
        await ctx.db.insert("schoolClassMaterialGroups", {
          ...Struct.omit(group, ["_id", "_creationTime"]),
          parentId: groupId,
          name: `Child ${index}`,
          order: index,
        });
      }
      await ctx.db.patch("schoolClassMaterialGroups", groupId, {
        childGroupCount: 26,
      });
    });
    await admin.mutation(api.classes.materials.mutations.deleteMaterialGroup, {
      groupId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 150);
    const state = await t.query(async (ctx) => ({
      groups: await ctx.db.query("schoolClassMaterialGroups").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state.groups).toEqual([]);
    expect(state.jobs.every((job) => job.state.kind === "success")).toBe(true);
  });

  it("decrements a parent group child count when a child group is deleted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "material-group-trigger-teacher",
      });
      const schoolId = await insertSchool(ctx, {
        now: NOW,
        userId: teacher.userId,
      });
      const classId = await insertClass(ctx, {
        now: NOW,
        schoolId,
        userId: teacher.userId,
      });

      await insertSchoolMembership(ctx, {
        now: NOW,
        role: "admin",
        schoolId,
        userId: teacher.userId,
      });
      await insertClassMembership(ctx, {
        classId,
        now: NOW,
        role: "teacher",
        schoolId,
        userId: teacher.userId,
      });

      return { classId, schoolId, teacher };
    });

    const teacherClient = t.withIdentity({
      subject: seeded.teacher.authUserId,
      sessionId: seeded.teacher.sessionId,
    });

    const parentId = await teacherClient.mutation(
      api.classes.materials.mutations.createMaterialGroup,
      {
        classId: seeded.classId,
        description: "Parent",
        name: "Parent",
        status: "published",
      }
    );

    const childId = await t.mutation(async (ctx) => {
      await ctx.db.patch("schoolClassMaterialGroups", parentId, {
        childGroupCount: 1,
      });

      return await ctx.db.insert("schoolClassMaterialGroups", {
        childGroupCount: 0,
        classId: seeded.classId,
        createdBy: seeded.teacher.userId,
        description: "Child",
        materialCount: 0,
        name: "Child",
        order: 0,
        parentId,
        publishedAt: NOW,
        publishedBy: seeded.teacher.userId,
        schoolId: seeded.schoolId,
        status: "published",
        updatedAt: NOW,
      });
    });

    await teacherClient.mutation(
      api.classes.materials.mutations.deleteMaterialGroup,
      { groupId: childId }
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await t.query(async (ctx) => ({
      child: await ctx.db.get("schoolClassMaterialGroups", childId),
      parent: await ctx.db.get("schoolClassMaterialGroups", parentId),
    }));

    expect(state.child).toBeNull();
    expect(state.parent?.childGroupCount).toBe(0);
    expect(state.parent?.updatedAt).toBe(NOW);
  });
});
