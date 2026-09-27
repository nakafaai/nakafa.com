import { expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";

it("enforces thread text, membership, and teacher-only tags before writing", async () => {
  const { t, admin, student, classId } = await createClassFixture();
  const create = api.classes.forums.mutations.forums.createForum;
  const input = {
    classId,
    title: "Algebra discussion",
    body: "Share solutions",
    tag: "general" as const,
  };
  for (const args of [
    { ...input, title: "   " },
    { ...input, body: "   " },
  ]) {
    await expect(admin.mutation(create, args)).rejects.toMatchObject({
      data: {
        code: args.title.trim()
          ? "FORUM_BODY_TOO_SHORT"
          : "FORUM_TITLE_TOO_SHORT",
      },
    });
  }
  await expect(student.mutation(create, input)).rejects.toMatchObject({
    data: { code: "ACCESS_DENIED" },
  });
  await admin.mutation(api.classes.mutations.updateClassVisibility, {
    classId,
    visibility: "public",
  });
  await student.mutation(api.classes.mutations.joinPublicClass, { classId });
  await expect(
    student.mutation(create, { ...input, tag: "announcement" })
  ).rejects.toMatchObject({ data: { code: "FORUM_TAG_ACCESS_DENIED" } });
  expect(
    await t.query((ctx) => ctx.db.query("schoolClassForums").collect())
  ).toEqual([]);
  const studentForumId = await student.mutation(create, input);
  const teacherForumId = await admin.mutation(create, {
    ...input,
    tag: "announcement",
  });
  expect(
    await t.query((ctx) => ctx.db.query("schoolClassForums").collect())
  ).toMatchObject([
    { _id: studentForumId, tag: "general" },
    { _id: teacherForumId, tag: "announcement" },
  ]);
  await t.mutation((ctx) =>
    ctx.db.patch("schoolClassForums", studentForumId, { status: "locked" })
  );
  await expect(
    student.mutation(api.classes.forums.mutations.posts.createForumPost, {
      forumId: studentForumId,
      body: "Late reply",
    })
  ).rejects.toMatchObject({ data: { code: "FORUM_LOCKED" } });
  await t.mutation((ctx) => ctx.db.delete("schoolClassForums", studentForumId));
  await expect(
    student.query(api.classes.forums.queries.pages.getForumPosts, {
      forumId: studentForumId,
    })
  ).rejects.toMatchObject({ data: { code: "FORUM_NOT_FOUND" } });
  await t.mutation((ctx) => ctx.db.delete("schoolClasses", classId));
  await expect(admin.mutation(create, input)).rejects.toMatchObject({
    data: { code: "CLASS_NOT_FOUND" },
  });
});
