import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { CLASS_IMAGES } from "@repo/backend/convex/lib/images";
import { createClassFixture } from "@repo/backend/test/classes";

const mutations = api.classes.mutations;

describe("class membership and administration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates class ownership and invite codes, then restricts administrative changes", async () => {
    const { t, admin, student, users, classId } = await createClassFixture();
    const initial = await t.query(async (ctx) => ({
      classroom: await ctx.db.get("schoolClasses", classId),
      members: await ctx.db.query("schoolClassMembers").collect(),
      invitations: await ctx.db.query("schoolClassInviteCodes").collect(),
    }));
    expect(initial.classroom).toMatchObject({
      name: "Algebra",
      studentCount: 0,
      teacherCount: 1,
      createdBy: users.admin.userId,
    });
    expect(initial.members).toMatchObject([
      { role: "teacher", teacherRole: "primary" },
    ]);
    expect(initial.invitations.map(({ role }) => role).sort()).toEqual([
      "student",
      "teacher",
    ]);
    await expect(
      student.mutation(mutations.updateClassVisibility, {
        classId,
        visibility: "public",
      })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await admin.mutation(mutations.updateClassVisibility, {
      classId,
      visibility: "public",
    });
    await admin.mutation(mutations.updateClassImage, {
      classId,
      image: "stars",
    });
    await expect(
      t.query((ctx) => ctx.db.get("schoolClasses", classId))
    ).resolves.toMatchObject({
      image: "stars",
      updatedBy: users.admin.userId,
      visibility: "public",
    });
  });

  it.each(["teacher", "student"] as const)(
    "joins an invited %s only after school membership is confirmed",
    async (role) => {
      const { t, student, outsider, users, classId } =
        await createClassFixture();
      const invite = await t.query((ctx) =>
        ctx.db
          .query("schoolClassInviteCodes")
          .withIndex("by_classId_and_role", (query) =>
            query.eq("classId", classId)
          )
          .collect()
      );
      const code = invite.find((entry) => entry.role === role)?.code;
      assert(code, "Expected the class role's invite code.");
      await expect(
        student.mutation(mutations.joinClass, { code: "missing" })
      ).rejects.toMatchObject({
        data: { code: "INVALID_CODE" },
      });
      await expect(
        outsider.mutation(mutations.joinClass, { code })
      ).rejects.toMatchObject({
        data: { code: "NOT_SCHOOL_MEMBER" },
      });
      await expect(
        student.mutation(mutations.joinClass, { code })
      ).resolves.toEqual({ classId });
      const member = await t.query((ctx) =>
        ctx.db
          .query("schoolClassMembers")
          .withIndex("by_classId_and_userId", (query) =>
            query.eq("classId", classId).eq("userId", users.student.userId)
          )
          .unique()
      );
      expect(member).toMatchObject({ role });
      expect(member?.teacherRole).toBe(
        role === "teacher" ? "co-teacher" : undefined
      );
      expect(member?.enrollMethod).toBe(
        role === "student" ? "by_code" : undefined
      );
      await expect(
        student.mutation(mutations.joinClass, { code })
      ).rejects.toMatchObject({
        data: { code: "ALREADY_MEMBER" },
      });
    }
  );

  it("allows school members to join public classes and rejects private or foreign-school access", async () => {
    const { t, admin, student, outsider, users, classId } =
      await createClassFixture();
    await expect(
      student.mutation(mutations.joinPublicClass, { classId })
    ).rejects.toMatchObject({
      data: { code: "CLASS_NOT_PUBLIC" },
    });
    await admin.mutation(mutations.updateClassVisibility, {
      classId,
      visibility: "public",
    });
    await expect(
      outsider.mutation(mutations.joinPublicClass, { classId })
    ).rejects.toMatchObject({
      data: { code: "NOT_SCHOOL_MEMBER" },
    });
    await expect(
      student.mutation(mutations.joinPublicClass, { classId })
    ).resolves.toEqual({ classId });
    await expect(
      t.query((ctx) =>
        ctx.db
          .query("schoolClassMembers")
          .withIndex("by_classId_and_userId", (query) =>
            query.eq("classId", classId).eq("userId", users.student.userId)
          )
          .unique()
      )
    ).resolves.toMatchObject({ role: "student", enrollMethod: "public" });
  });

  it("rejects a class image when its registered asset is unavailable", async () => {
    const { t, admin, classId } = await createClassFixture();
    const before = await t.query((ctx) => ctx.db.get("schoolClasses", classId));
    vi.spyOn(CLASS_IMAGES, "has").mockReturnValueOnce(false);
    await expect(
      admin.mutation(mutations.updateClassImage, { classId, image: "stars" })
    ).rejects.toMatchObject({
      data: { code: "INVALID_IMAGE" },
    });
    await expect(
      t.query((ctx) => ctx.db.get("schoolClasses", classId))
    ).resolves.toEqual(before);
  });
});
