import { api } from "@repo/backend/convex/_generated/api";
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
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 14, 12, 0, 0);

describe("classes/queries:getClassRoute", () => {
  it("returns the accessible route snapshot for class members", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, { now: NOW });
      const schoolId = await insertSchool(ctx, {
        now: NOW,
        userId: viewer.userId,
        email: "school@example.com",
        slug: "nakafa-school",
      });

      await insertSchoolMembership(ctx, {
        now: NOW,
        role: "teacher",
        schoolId,
        userId: viewer.userId,
      });

      const classId = await insertClass(ctx, {
        now: NOW,
        schoolId,
        userId: viewer.userId,
      });

      await insertClassMembership(ctx, {
        now: NOW,
        classId,
        role: "teacher",
        schoolId,
        userId: viewer.userId,
      });

      return { ...viewer, classId };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.queries.getClassRoute, { classId: identity.classId });

    expect(result.kind).toBe("accessible");

    if (result.kind !== "accessible") {
      throw new Error("Expected an accessible class route snapshot.");
    }

    expect(result.class._id).toBe(identity.classId);
    expect(result.classMembership?.role).toBe("teacher");
    expect(result.schoolMembership.role).toBe("teacher");
  });

  it("returns the join screen snapshot for school members outside the class", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "teacher",
      });
      const student = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "student",
      });
      const schoolId = await insertSchool(ctx, {
        now: NOW,
        userId: teacher.userId,
        email: "school@example.com",
        slug: "nakafa-school",
      });

      await insertSchoolMembership(ctx, {
        now: NOW,
        role: "teacher",
        schoolId,
        userId: teacher.userId,
      });

      await insertSchoolMembership(ctx, {
        now: NOW,
        role: "student",
        schoolId,
        userId: student.userId,
      });

      const classId = await insertClass(ctx, {
        now: NOW,
        schoolId,
        userId: teacher.userId,
      });

      await insertClassMembership(ctx, {
        now: NOW,
        classId,
        role: "teacher",
        schoolId,
        userId: teacher.userId,
      });

      return { ...student, classId };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.queries.getClassRoute, { classId: identity.classId });

    expect(result).toEqual({
      kind: "joinRequired",
      class: expect.objectContaining({
        _id: identity.classId,
        name: "Class 10A",
        visibility: "public",
      }),
      schoolMembership: expect.objectContaining({
        role: "student",
      }),
    });
  });
});
