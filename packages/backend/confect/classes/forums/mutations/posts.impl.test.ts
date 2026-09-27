// @vitest-environment node
import { GenericId } from "@confect/core";
import { afterEach, expect, it } from "@effect/vitest";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/classes/forums/constants";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";
import { Schema } from "effect";

afterEach(() => vi.unstubAllEnvs());

it("validates replies and atomically consumes an attachment-only post", async () => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", "technical-webhook-secret");
  const { t, admin, classId, users } = await createClassFixture();
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
  const transcript = api.classes.forums.queries.pages.getForumPosts;
  expect(await admin.query(transcript, { forumId })).toEqual([]);
  await expect(
    admin.mutation(post, {
      forumId,
      body: "   ",
    })
  ).rejects.toMatchObject({
    data: {
      code: "EMPTY_POST",
    },
  });
  const parentId = await admin.mutation(post, {
    forumId: otherForumId,
    body: "Other discussion",
  });
  await expect(
    admin.mutation(post, {
      forumId,
      body: "Reply",
      parentId,
    })
  ).rejects.toMatchObject({
    data: {
      code: "PARENT_POST_NOT_FOUND",
    },
  });
  await t.mutation((ctx) => ctx.db.delete("schoolClassForumPosts", parentId));
  await expect(
    admin.mutation(post, {
      forumId,
      body: "Reply",
      parentId,
    })
  ).rejects.toMatchObject({
    data: {
      code: "PARENT_POST_NOT_FOUND",
    },
  });
  const upload = await admin.mutation(
    api.classes.forums.mutations.uploads.generateUploadUrl,
    {
      forumId,
    }
  );
  await expect(
    admin.mutation(post, {
      forumId,
      body: "Too many",
      attachmentUploadIds: Array.from(
        {
          length: MAX_FORUM_POST_ATTACHMENTS + 1,
        },
        () => upload.uploadId
      ),
    })
  ).rejects.toMatchObject({
    data: {
      code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
    },
  });
  await expect(
    admin.mutation(post, {
      forumId,
      body: "",
      attachmentUploadIds: [upload.uploadId],
    })
  ).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_UPLOAD_INCOMPLETE" },
  });
  expect(await admin.query(transcript, { forumId })).toEqual([]);
  const response = await t.fetch(new URL(upload.uploadUrl).pathname, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hello",
  });
  expect(response.status).toBe(200);
  const { storageId } = Schema.decodeUnknownSync(
    Schema.Struct({
      storageId: GenericId.GenericId("_storage"),
    })
  )(await response.json());
  await admin.mutation(api.classes.forums.mutations.uploads.saveForumUpload, {
    uploadId: upload.uploadId,
    storageId,
    name: "notes.txt",
    size: 5,
    type: "text/plain",
  });
  await expect(
    admin.mutation(post, {
      forumId: otherForumId,
      body: "Other discussion",
      attachmentUploadIds: [upload.uploadId],
    })
  ).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND" },
  });
  expect(
    await t.query(async (ctx) => ({
      attachments: await ctx.db
        .query("schoolClassForumPostAttachments")
        .collect(),
      upload: await ctx.db.get(upload.uploadId),
    }))
  ).toMatchObject({ attachments: [], upload: { forumId, storageId } });
  expect(await admin.query(transcript, { forumId: otherForumId })).toEqual([]);
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
  expect(state.post).toMatchObject({
    body: "",
    forumId,
  });
  expect(state.post).not.toHaveProperty("parentId");
  expect(state.post).not.toHaveProperty("replyToBody");
  expect(state.attachment).toMatchObject({
    postId,
    fileId: storageId,
    name: "notes.txt",
    size: 5,
  });
  expect(state.pending).toBeNull();
  expect(await admin.query(transcript, { forumId })).toMatchObject([
    {
      _id: postId,
      body: "",
      attachments: [
        {
          name: "notes.txt",
          mimeType: "text/plain",
          size: 5,
          url: expect.any(String),
        },
      ],
    },
  ]);
  await t.run((ctx) => ctx.storage.delete(storageId));
  expect(await admin.query(transcript, { forumId })).toMatchObject([
    {
      _id: postId,
      attachments: [{ name: "notes.txt", size: 5, url: null }],
    },
  ]);
  const replyId = await admin.mutation(post, {
    forumId,
    body: "My worked solution",
    parentId: postId,
  });
  expect(await admin.query(transcript, { forumId })).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        _id: replyId,
        parentId: postId,
        replyToUser: expect.objectContaining({ _id: users.admin.userId }),
      }),
    ])
  );
  await t.mutation(async (ctx) => {
    for (let index = 0; index <= MAX_FORUM_POST_ATTACHMENTS; index += 1) {
      await ctx.db.insert("schoolClassForumPostAttachments", {
        classId,
        createdBy: users.admin.userId,
        fileId: storageId,
        forumId,
        mimeType: "text/plain",
        name: `corrupted-${index}.txt`,
        postId: replyId,
        size: 5,
      });
    }
  });
  await expect(admin.query(transcript, { forumId })).rejects.toMatchObject({
    data: { code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED" },
  });
});
