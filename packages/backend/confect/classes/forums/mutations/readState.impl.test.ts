import { Ref } from "@confect/core";
import { assert, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";
import { Option } from "effect";

const now = Date.UTC(2026, 8, 1);

it("rejects missing and foreign read boundaries without writes and keeps accepted progress monotone", async () => {
  const { t, admin, student, users, classId, schoolId } =
    await createClassFixture();
  await t.mutation((ctx) =>
    ctx.db.insert("schoolClassMembers", {
      classId,
      schoolId,
      userId: users.student.userId,
      role: "student",
      enrollMethod: "public",
      updatedAt: now,
    })
  );
  const forumId = await admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId,
      title: "Read boundaries",
      body: "Progress belongs to this forum",
      tag: "general",
    }
  );
  const foreignForumId = await admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId,
      title: "Another forum",
      body: "An independent read boundary",
      tag: "general",
    }
  );
  const first = await admin.mutation(
    api.classes.forums.mutations.posts.createForumPost,
    { forumId, body: "First" }
  );
  const second = await admin.mutation(
    api.classes.forums.mutations.posts.createForumPost,
    { forumId, body: "Second" }
  );
  const foreign = await admin.mutation(
    api.classes.forums.mutations.posts.createForumPost,
    { forumId: foreignForumId, body: "Foreign" }
  );
  const missing = await admin.mutation(
    api.classes.forums.mutations.posts.createForumPost,
    { forumId, body: "Deleted" }
  );
  await t.mutation((ctx) => ctx.db.delete("schoolClassForumPosts", missing));
  for (const lastReadPostId of [missing, foreign]) {
    const failure = await student
      .mutation(api.classes.forums.mutations.readState.markForumRead, {
        forumId,
        lastReadPostId,
      })
      .catch((error: unknown) => error);
    assert(Ref.isConvexError(failure));
    expect(failure.data).toEqual({
      _tag: "ForumError",
      code: "POST_NOT_FOUND",
      message: "Read boundary post not found.",
    });
    const decoded = Ref.decodeErrorOption(
      refs.public.classes.forums.mutations.readState.markForumRead,
      failure.data
    );
    expect(Option.map(decoded, (error) => error._tag)).toEqual(
      Option.some("ForumError")
    );
  }
  expect(
    await t.query((ctx) =>
      ctx.db
        .query("schoolClassForumReadStates")
        .withIndex("by_forumId_and_userId", (q) =>
          q.eq("forumId", forumId).eq("userId", users.student.userId)
        )
        .unique()
    )
  ).toBeNull();
  for (const lastReadPostId of [first, second, first]) {
    await student.mutation(
      api.classes.forums.mutations.readState.markForumRead,
      { forumId, lastReadPostId }
    );
  }
  expect(
    await t.query((ctx) =>
      ctx.db
        .query("schoolClassForumReadStates")
        .withIndex("by_forumId_and_userId", (q) =>
          q.eq("forumId", forumId).eq("userId", users.student.userId)
        )
        .unique()
    )
  ).toMatchObject({ classId, lastReadSequence: 2 });
});
