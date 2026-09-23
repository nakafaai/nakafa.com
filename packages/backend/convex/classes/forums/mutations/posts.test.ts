import { expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/convex/classes/forums/utils/constants";
import { createClassFixture } from "@repo/backend/test/classes";

it("validates replies and atomically consumes an attachment-only post", async () => {
  const { t, admin, classId } = await createClassFixture();
  const forumId = await admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId,
      title: "Algebra discussion",
      body: "Discuss the proof",
      tag: "general",
    }
  );
  const otherForumId = await admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId,
      title: "Geometry discussion",
      body: "Discuss the geometry",
      tag: "general",
    }
  );
  const post = api.classes.forums.mutations.posts.createForumPost;
  await expect(
    admin.mutation(post, { forumId, body: "   " })
  ).rejects.toMatchObject({ data: { code: "EMPTY_POST" } });
  const parentId = await admin.mutation(post, {
    forumId: otherForumId,
    body: "Other discussion",
  });
  await expect(
    admin.mutation(post, { forumId, body: "Reply", parentId })
  ).rejects.toMatchObject({ data: { code: "PARENT_POST_NOT_FOUND" } });
  await t.mutation((ctx) => ctx.db.delete("schoolClassForumPosts", parentId));
  await expect(
    admin.mutation(post, { forumId, body: "Reply", parentId })
  ).rejects.toMatchObject({ data: { code: "PARENT_POST_NOT_FOUND" } });
  const upload = await admin.mutation(
    api.classes.forums.mutations.uploads.generateUploadUrl,
    { forumId }
  );
  await expect(
    admin.mutation(post, {
      forumId,
      body: "Too many",
      attachmentUploadIds: Array.from(
        { length: MAX_FORUM_POST_ATTACHMENTS + 1 },
        () => upload.uploadId
      ),
    })
  ).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED" },
  });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new File(["hello"], "notes.txt", { type: "text/plain" }))
  );
  await t.mutation((ctx) =>
    ctx.db.patch("schoolClassForumPendingUploads", upload.uploadId, {
      mimeType: "text/plain",
      name: "notes.txt",
      size: 5,
      storageId,
    })
  );
  const postId = await admin.mutation(post, {
    forumId,
    body: "",
    attachmentUploadIds: [upload.uploadId],
  });
  const state = await t.query(async (ctx) => ({
    post: await ctx.db.get("schoolClassForumPosts", postId),
    attachment: await ctx.db.query("schoolClassForumPostAttachments").unique(),
    pending: await ctx.db.get(
      "schoolClassForumPendingUploads",
      upload.uploadId
    ),
  }));
  expect(state.post).toMatchObject({ body: "", forumId });
  expect(state.post).not.toHaveProperty("parentId");
  expect(state.post).not.toHaveProperty("replyToBody");
  expect(state.attachment).toMatchObject({
    postId,
    fileId: storageId,
    name: "notes.txt",
    size: 5,
  });
  expect(state.pending).toBeNull();
});
