import { Ref } from "@confect/core";
import { expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { MAX_FORUM_POST_MENTIONS } from "@repo/backend/confect/classes/forums/constants";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createClassFixture } from "@repo/backend/test/classes";
import { Array as Arr, Option } from "effect";

it("deduplicates authorized mentions and rejects stale school access atomically", async () => {
  const { t, admin, users, classId, schoolId } = await createClassFixture();
  const forumId = await admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId,
      title: "Mention access",
      body: "School membership controls access",
      tag: "general",
    }
  );
  await t.mutation((ctx) =>
    ctx.db.insert("schoolClassMembers", {
      classId,
      schoolId,
      userId: users.student.userId,
      role: "student",
      enrollMethod: "public",
      updatedAt: Date.now(),
    })
  );
  const accepted = await admin.mutation(
    api.classes.forums.mutations.posts.createForumPost,
    {
      forumId,
      body: "An authorized mention",
      mentions: [
        users.student.userId,
        users.student.userId,
        users.admin.userId,
      ],
    }
  );
  expect(
    await t.query((ctx) => ctx.db.get("schoolClassForumPosts", accepted))
  ).toMatchObject({
    mentions: [users.student.userId, users.admin.userId],
  });
  await t.mutation(async (ctx) => {
    const membership = await ctx.db
      .query("schoolMembers")
      .withIndex("by_schoolId_and_userId_and_status", (q) =>
        q
          .eq("schoolId", schoolId)
          .eq("userId", users.student.userId)
          .eq("status", "active")
      )
      .unique();
    if (membership) {
      await ctx.db.patch("schoolMembers", membership._id, {
        status: "removed",
      });
    }
  });
  const rejected = await admin
    .mutation(api.classes.forums.mutations.posts.createForumPost, {
      forumId,
      body: "A removed member must not be mentioned",
      mentions: [users.student.userId],
    })
    .catch((error: unknown) => error);
  expect(rejected).toMatchObject({
    data: {
      code: "INVALID_FORUM_MENTION",
    },
  });
  if (!Ref.isConvexError(rejected)) {
    throw rejected;
  }
  const decoded = Ref.decodeErrorOption(
    refs.public.classes.forums.mutations.posts.createForumPost,
    rejected.data
  );
  expect(
    Option.map(decoded, (error) => ({
      _tag: error._tag,
      code: error.code,
    }))
  ).toEqual(
    Option.some({
      _tag: "ForumError",
      code: "INVALID_FORUM_MENTION",
    })
  );
  expect(
    await t.query((ctx) => ctx.db.query("schoolClassForumPosts").collect())
  ).toHaveLength(1);
});
it("rejects oversized mention sets before writing a post", async () => {
  const { t, admin, classId } = await createClassFixture();
  const forumId = await admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId,
      title: "Bounded mentions",
      body: "Mention fanout stays bounded",
      tag: "general",
    }
  );
  const mentions = await t.mutation(async (ctx) => {
    let ids: Id<"users">[] = [];
    for (let i = 0; i <= MAX_FORUM_POST_MENTIONS; i += 1) {
      ids = Arr.append(
        ids,
        await ctx.db.insert("users", {
          authId: `mention-${i}`,
          credits: 0,
          creditsResetAt: 0,
          email: `mention-${i}@example.com`,
          name: `Mention ${i}`,
          plan: "free",
        })
      );
    }
    return ids;
  });
  await expect(
    admin.mutation(api.classes.forums.mutations.posts.createForumPost, {
      forumId,
      body: "Too many mentions",
      mentions,
    })
  ).rejects.toMatchObject({
    data: {
      code: "FORUM_MENTION_LIMIT_EXCEEDED",
    },
  });
  expect(
    await t.query((ctx) => ctx.db.query("schoolClassForumPosts").collect())
  ).toHaveLength(0);
});
