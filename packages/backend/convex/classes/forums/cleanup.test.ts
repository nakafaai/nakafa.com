import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  cleanupForumData,
  cleanupForumPostData,
} from "@repo/backend/convex/classes/forums/cleanup";
import {
  insertClass,
  insertSchool,
} from "@repo/backend/convex/classes/test.helpers";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";

const NOW = Date.UTC(2026, 8, 19);
afterEach(() => vi.restoreAllMocks());

describe("forum cleanup storage ownership", () => {
  it("deletes attachment and upload blobs before removing their forum records", async () => {
    const t = createConvexTestWithBetterAuth();
    const attachmentBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["attachment"]))
    );
    const uploadBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["pending"]))
    );
    const rows = await t.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, { now: NOW });
      const schoolId = await insertSchool(ctx, { now: NOW, userId });
      const classId = await insertClass(ctx, { now: NOW, schoolId, userId });
      const forumId = await ctx.db.insert("schoolClassForums", {
        body: "Cleanup storage",
        classId,
        createdBy: userId,
        isPinned: false,
        lastPostAt: NOW,
        lastPostBy: userId,
        nextPostSequence: 2,
        postCount: 1,
        reactionCounts: [],
        schoolId,
        status: "open",
        tag: "general",
        title: "Cleanup",
        updatedAt: NOW,
      });
      const postId = await ctx.db.insert("schoolClassForumPosts", {
        body: "Attached post",
        classId,
        createdBy: userId,
        forumId,
        mentions: [],
        reactionCounts: [],
        replyCount: 0,
        sequence: 1,
        updatedAt: NOW,
      });
      const attachmentId = await ctx.db.insert(
        "schoolClassForumPostAttachments",
        {
          classId,
          createdBy: userId,
          fileId: attachmentBlob,
          forumId,
          mimeType: "text/plain",
          name: "attachment.txt",
          postId,
          size: 10,
        }
      );
      const uploadId = await ctx.db.insert("schoolClassForumPendingUploads", {
        classId,
        expiresAt: NOW,
        forumId,
        storageId: uploadBlob,
        uploadedBy: userId,
        uploadToken: "pending",
      });
      const emptyUploadId = await ctx.db.insert(
        "schoolClassForumPendingUploads",
        {
          classId,
          expiresAt: NOW,
          forumId,
          uploadedBy: userId,
          uploadToken: "empty",
        }
      );
      return { attachmentId, emptyUploadId, forumId, postId, uploadId };
    });
    await t.mutation((ctx) =>
      runConvexProgram(cleanupForumPostData(ctx, rows.postId))
    );
    expect(await t.run((ctx) => ctx.storage.get(attachmentBlob))).toBeNull();
    expect(
      await t.query((ctx) =>
        ctx.db.get("schoolClassForumPostAttachments", rows.attachmentId)
      )
    ).toBeNull();
    expect(
      await t.query((ctx) => ctx.db.get("schoolClassForumPosts", rows.postId))
    ).not.toBeNull();
    await t.mutation((ctx) =>
      runConvexProgram(cleanupForumData(ctx, rows.forumId))
    );
    expect(await t.run((ctx) => ctx.storage.get(uploadBlob))).toBeNull();
    expect(
      await t.query((ctx) =>
        ctx.db.get("schoolClassForumPendingUploads", rows.uploadId)
      )
    ).toBeNull();
    expect(
      await t.query((ctx) =>
        ctx.db.get("schoolClassForumPendingUploads", rows.emptyUploadId)
      )
    ).toBeNull();
    await expect(
      t.mutation((ctx) => {
        vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
          throw new Error("database unavailable");
        });
        return runConvexProgram(cleanupForumData(ctx, rows.forumId));
      })
    ).rejects.toMatchObject({
      data: { code: "FORUM_CLEANUP_FAILED", message: "database unavailable" },
    });
    expect(
      await t.query((ctx) => ctx.db.get("schoolClassForums", rows.forumId))
    ).not.toBeNull();
  });
});
