import { api } from "@repo/backend/convex/_generated/api";
import { NOW } from "@repo/backend/convex/assessments/seed";
import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/convex/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("triggers/materials/materials", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cleans deleted material attachments and views through the group trigger chain", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "material-trigger-teacher",
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

    const groupId = await teacherClient.mutation(
      api.classes.materials.mutations.createMaterialGroup,
      {
        classId: seeded.classId,
        description: "Cleanup target",
        name: "Cleanup target",
        status: "published",
      }
    );

    const rows = await t.run(async (ctx) => {
      const fileId = await ctx.storage.store(
        new Blob(["material"], { type: "text/plain" })
      );
      const materialId = await ctx.db.insert("schoolClassMaterials", {
        attachmentCount: 1,
        classId: seeded.classId,
        createdBy: seeded.teacher.userId,
        downloadCount: 0,
        groupId,
        isPinned: false,
        order: 0,
        publishedAt: NOW,
        publishedBy: seeded.teacher.userId,
        schoolId: seeded.schoolId,
        status: "published",
        title: "Material",
        totalFileSize: 8,
        updatedAt: NOW,
        viewCount: 1,
      });
      const attachmentId = await ctx.db.insert(
        "schoolClassMaterialAttachments",
        {
          classId: seeded.classId,
          downloadCount: 0,
          fileId,
          groupId,
          materialId,
          mimeType: "text/plain",
          name: "material.txt",
          order: 0,
          size: 8,
          type: "download",
          uploadedBy: seeded.teacher.userId,
        }
      );
      const viewId = await ctx.db.insert("schoolClassMaterialViews", {
        classId: seeded.classId,
        firstViewedAt: NOW,
        hasDownloaded: false,
        lastViewedAt: NOW,
        materialId,
        userId: seeded.teacher.userId,
        viewCount: 1,
      });

      return { attachmentId, materialId, viewId };
    });

    await teacherClient.mutation(
      api.classes.materials.mutations.deleteMaterialGroup,
      { groupId }
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const deletedRows = await t.query(async (ctx) => ({
      attachment: await ctx.db.get(
        "schoolClassMaterialAttachments",
        rows.attachmentId
      ),
      group: await ctx.db.get("schoolClassMaterialGroups", groupId),
      material: await ctx.db.get("schoolClassMaterials", rows.materialId),
      view: await ctx.db.get("schoolClassMaterialViews", rows.viewId),
    }));

    expect(deletedRows).toEqual({
      attachment: null,
      group: null,
      material: null,
      view: null,
    });
  });
});
