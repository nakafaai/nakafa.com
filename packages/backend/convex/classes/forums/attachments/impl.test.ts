import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  validateForumAttachmentPolicy,
  validateForumAttachmentStorageClaim,
} from "@repo/backend/convex/classes/forums/attachments/impl";
import {
  MAX_FORUM_ATTACHMENT_BYTES,
  MAX_FORUM_POST_ATTACHMENTS,
} from "@repo/backend/convex/classes/forums/utils/constants";
import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/convex/classes/test.helpers";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 15, 0, 0);

function getConvexErrorData(error: unknown) {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    throw new Error("Expected a ConvexError with data.");
  }

  return error.data;
}

async function getRejectedConvexErrorData(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return getConvexErrorData(error);
  }

  throw new Error("Expected a ConvexError rejection.");
}

async function seedOpenForum(ctx: MutationCtx) {
  const user = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix: "forum-attachment-owner",
  });
  const schoolId = await insertSchool(ctx, {
    now: NOW,
    userId: user.userId,
  });
  const classId = await insertClass(ctx, {
    now: NOW,
    schoolId,
    userId: user.userId,
  });

  await insertSchoolMembership(ctx, {
    now: NOW,
    role: "teacher",
    schoolId,
    userId: user.userId,
  });
  await insertClassMembership(ctx, {
    now: NOW,
    role: "teacher",
    classId,
    schoolId,
    userId: user.userId,
  });

  const forumId = await ctx.db.insert("schoolClassForums", {
    body: "Attachment forum body",
    classId,
    createdBy: user.userId,
    isPinned: false,
    lastPostAt: NOW,
    lastPostBy: user.userId,
    nextPostSequence: 1,
    postCount: 0,
    reactionCounts: [],
    schoolId,
    status: "open",
    tag: "general",
    title: "Attachment forum",
    updatedAt: NOW,
  });

  return { ...user, classId, forumId };
}

async function createForumOwner() {
  const t = createConvexTestWithBetterAuth();
  const seeded = await t.mutation(seedOpenForum);
  const owner = t.withIdentity({
    sessionId: seeded.sessionId,
    subject: seeded.authUserId,
  });

  return { owner, seeded, t };
}

async function storeTextFile(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  return await t.run(
    async (ctx) =>
      await ctx.storage.store(
        new File(["hello"], "notes.txt", { type: "text/plain" })
      )
  );
}

describe("classes/forums/attachments/impl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces the forum attachment file policy", async () => {
    for (const input of [
      { mimeType: "image/png", name: "diagram.png", size: 1 },
      { mimeType: "application/octet-stream", name: "handout.pdf", size: 1 },
      { mimeType: "text/plain", name: "notes.txt", size: 1 },
    ]) {
      await expect(
        runConvexProgram(validateForumAttachmentPolicy(input))
      ).resolves.toBeUndefined();
    }

    for (const [input, code] of [
      [
        {
          mimeType: "text/plain",
          name: "large.txt",
          size: MAX_FORUM_ATTACHMENT_BYTES + 1,
        },
        "FORUM_ATTACHMENT_TOO_LARGE",
      ],
      [
        { mimeType: "application/x-msdownload", name: "malware.exe", size: 1 },
        "FORUM_ATTACHMENT_TYPE_UNSUPPORTED",
      ],
    ] as const) {
      await expect(
        getRejectedConvexErrorData(
          runConvexProgram(validateForumAttachmentPolicy(input))
        )
      ).resolves.toMatchObject({ code });
    }
  });

  it("rejects duplicate upload claims and discards finalized pending uploads", async () => {
    vi.setSystemTime(new Date(NOW));

    const { owner, seeded, t } = await createForumOwner();
    const upload = await owner.mutation(
      api.classes.forums.mutations.uploads.generateUploadUrl,
      { forumId: seeded.forumId }
    );
    const storageId = await storeTextFile(t);

    await expect(
      getRejectedConvexErrorData(
        owner.mutation(api.classes.forums.mutations.posts.createForumPost, {
          attachmentUploadIds: [upload.uploadId, upload.uploadId],
          body: "Duplicate attachment",
          forumId: seeded.forumId,
        })
      )
    ).resolves.toEqual({
      code: "FORUM_ATTACHMENT_DUPLICATE",
      message: "Forum post attachments must reference distinct uploads.",
    });

    await t.mutation(async (ctx) => {
      await ctx.db.patch("schoolClassForumPendingUploads", upload.uploadId, {
        mimeType: "text/plain",
        name: "notes.txt",
        size: 5,
        storageId,
      });
    });

    await owner.mutation(
      api.classes.forums.mutations.uploads.discardForumUploads,
      { uploadIds: [upload.uploadId] }
    );

    const state = await t.query(async (ctx) => ({
      pendingUpload: await ctx.db.get(
        "schoolClassForumPendingUploads",
        upload.uploadId
      ),
      storageMetadata: await ctx.db.system.get("_storage", storageId),
    }));

    expect(state.pendingUpload).toBeNull();
    expect(state.storageMetadata).toBeNull();
  });

  it("rejects uploads whose saved metadata no longer matches storage", async () => {
    vi.setSystemTime(new Date(NOW));

    const { owner, seeded, t } = await createForumOwner();
    const upload = await owner.mutation(
      api.classes.forums.mutations.uploads.generateUploadUrl,
      { forumId: seeded.forumId }
    );
    const storageId = await storeTextFile(t);

    await expect(
      getRejectedConvexErrorData(
        owner.mutation(api.classes.forums.mutations.uploads.saveForumUpload, {
          name: "notes.txt",
          size: 6,
          storageId,
          type: "text/plain",
          uploadId: upload.uploadId,
        })
      )
    ).resolves.toEqual({
      code: "FORUM_ATTACHMENT_METADATA_MISMATCH",
      message: "Forum post attachment metadata no longer matches the upload.",
    });
  });

  it("rejects storage already claimed by another pending upload", async () => {
    const { seeded, t } = await createForumOwner();
    const storageId = await storeTextFile(t);

    const uploadIds = await t.mutation(async (ctx) => {
      const firstUploadId = await ctx.db.insert(
        "schoolClassForumPendingUploads",
        {
          classId: seeded.classId,
          forumId: seeded.forumId,
          mimeType: "text/plain",
          name: "notes.txt",
          size: 5,
          storageId,
          uploadedBy: seeded.userId,
        }
      );
      const secondUploadId = await ctx.db.insert(
        "schoolClassForumPendingUploads",
        {
          classId: seeded.classId,
          forumId: seeded.forumId,
          uploadedBy: seeded.userId,
        }
      );

      return { firstUploadId, secondUploadId };
    });

    await expect(
      getRejectedConvexErrorData(
        t.run((ctx) =>
          runConvexProgram(
            validateForumAttachmentStorageClaim(ctx, {
              storageId,
              uploadId: uploadIds.secondUploadId,
            })
          )
        )
      )
    ).resolves.toMatchObject({
      code: "FORUM_ATTACHMENT_UPLOAD_ALREADY_CLAIMED",
    });
  });

  it("rejects storage already attached to a forum post", async () => {
    const { seeded, t } = await createForumOwner();
    const storageId = await storeTextFile(t);

    const uploadId = await t.mutation(async (ctx) => {
      const postId = await ctx.db.insert("schoolClassForumPosts", {
        body: "Attached file",
        classId: seeded.classId,
        createdBy: seeded.userId,
        forumId: seeded.forumId,
        mentions: [],
        reactionCounts: [],
        replyCount: 0,
        sequence: 1,
        updatedAt: NOW,
      });

      await ctx.db.insert("schoolClassForumPostAttachments", {
        classId: seeded.classId,
        createdBy: seeded.userId,
        fileId: storageId,
        forumId: seeded.forumId,
        mimeType: "text/plain",
        name: "notes.txt",
        postId,
        size: 5,
      });

      return await ctx.db.insert("schoolClassForumPendingUploads", {
        classId: seeded.classId,
        forumId: seeded.forumId,
        uploadedBy: seeded.userId,
      });
    });

    await expect(
      getRejectedConvexErrorData(
        t.run((ctx) =>
          runConvexProgram(
            validateForumAttachmentStorageClaim(ctx, {
              storageId,
              uploadId,
            })
          )
        )
      )
    ).resolves.toMatchObject({
      code: "FORUM_ATTACHMENT_ALREADY_ATTACHED",
    });
  });

  it("rejects upload URL requests once the pending attachment limit is reached", async () => {
    vi.setSystemTime(new Date(NOW));

    const { owner, seeded } = await createForumOwner();

    for (let index = 0; index < MAX_FORUM_POST_ATTACHMENTS; index += 1) {
      await owner.mutation(
        api.classes.forums.mutations.uploads.generateUploadUrl,
        { forumId: seeded.forumId }
      );
    }

    await expect(
      getRejectedConvexErrorData(
        owner.mutation(api.classes.forums.mutations.uploads.generateUploadUrl, {
          forumId: seeded.forumId,
        })
      )
    ).resolves.toEqual({
      code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
      message: "Forum post attachment count exceeds the supported limit.",
    });
  });
});
