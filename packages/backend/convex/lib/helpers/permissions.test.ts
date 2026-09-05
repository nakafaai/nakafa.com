import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  PERMISSIONS,
  requirePermission,
} from "@repo/backend/convex/lib/helpers/permissions";
import { createClassFixture } from "@repo/backend/test/classes";
import { Effect } from "effect";

describe("school and class permission grants", () => {
  it("requires an explicit target and an active school grant", async () => {
    const { t, users, schoolId } = await createClassFixture();
    for (const target of [
      { userId: users.admin.userId },
      { userId: users.outsider.userId, schoolId },
      { userId: users.student.userId, schoolId },
    ]) {
      const denied = await t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.CLASS_DELETE, target).pipe(
            Effect.match({
              onFailure: ({ _tag, code, message }) => ({ _tag, code, message }),
              onSuccess: () => undefined,
            })
          )
        )
      );
      expect(denied).toEqual({
        _tag: "PermissionDenied",
        code: "FORBIDDEN",
        message: "Permission 'class:delete' required",
      });
    }
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.CLASS_DELETE, {
            userId: users.admin.userId,
            schoolId,
          }).pipe(Effect.as(true))
        )
      )
    ).resolves.toBe(true);
  });

  it("combines class roles with teacher-specific grants without granting unrelated permissions", async () => {
    const { t, users, schoolId, classId } = await createClassFixture();
    const target = { classId, schoolId, userId: users.student.userId };
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.CLASS_WRITE, target)
        )
      )
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const memberId = await t.mutation((ctx) =>
      ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: users.student.userId,
        role: "student",
        updatedAt: 0,
      })
    );
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.CONTENT_READ, {
            ...target,
            schoolId: undefined,
          }).pipe(Effect.as(true))
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.CONTENT_DELETE, target)
        )
      )
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await t.mutation((ctx) =>
      ctx.db.patch("schoolClassMembers", memberId, { role: "teacher" })
    );
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.CONTENT_DELETE, target)
        )
      )
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await t.mutation((ctx) =>
      ctx.db.patch("schoolClassMembers", memberId, {
        teacherRole: "co-teacher",
      })
    );
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.CONTENT_DELETE, target).pipe(
            Effect.as(true)
          )
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          requirePermission(ctx, PERMISSIONS.MEMBER_REMOVE, target)
        )
      )
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});
