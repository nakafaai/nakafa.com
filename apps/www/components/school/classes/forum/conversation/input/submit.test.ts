// @vitest-environment node

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import { Effect, Either } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitForumPost } from "./submit";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@repo/analytics/posthog", () => ({
  captureException: mocks.captureException,
}));

vi.mock("ky", () => ({
  default: {
    post: mocks.post,
  },
}));

const forumId = "forum_1" as Id<"schoolClassForums">;
const postId = "post_1" as Id<"schoolClassForumPosts">;
const storageId = "storage_1" as Id<"_storage">;
const uploadUrl = "https://upload.example.test/file";

type SubmitForumPostInput = Parameters<typeof submitForumPost>[0];

describe("submitForumPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockReturnValue({
      json: vi.fn(async () => ({ storageId })),
    });
  });

  it("creates a text-only post without upload mutations", async () => {
    const mutations = {
      createPost: vi.fn(async () => postId),
      discardForumUploads: vi.fn(async () => null),
      generateUploadUrl: vi.fn(),
      saveForumUpload: vi.fn(),
    } satisfies SubmitForumPostInput["mutations"];

    const result = await Effect.runPromise(
      Effect.either(
        submitForumPost({
          files: [],
          mutations,
          post: {
            body: "hello",
            forumId,
            parentId: undefined,
          },
        })
      )
    );

    expect(Either.isRight(result)).toBe(true);
    expect(mutations.createPost).toHaveBeenCalledWith({
      attachmentUploadIds: undefined,
      body: "hello",
      forumId,
      parentId: undefined,
    });
    expect(mutations.generateUploadUrl).not.toHaveBeenCalled();
    expect(mutations.discardForumUploads).not.toHaveBeenCalled();
  });

  it("does not discard pending uploads when a text-only post fails", async () => {
    const mutations = {
      createPost: vi.fn(() => Promise.reject(new Error("post failed"))),
      discardForumUploads: vi.fn(async () => null),
      generateUploadUrl: vi.fn(),
      saveForumUpload: vi.fn(),
    } satisfies SubmitForumPostInput["mutations"];

    const result = await Effect.runPromise(
      Effect.either(
        submitForumPost({
          files: [],
          mutations,
          post: {
            body: "hello",
            forumId,
            parentId: undefined,
          },
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.discardForumUploads).not.toHaveBeenCalled();
  });

  it("uploads new File objects and ignores existing file metadata", async () => {
    const uploadId = "upload_for_file" as Id<"schoolClassForumPendingUploads">;
    const files = [
      {
        file: {
          id: "existing",
          name: "existing.txt",
          size: 8,
          type: "text/plain",
          url: "https://files.example.test/existing.txt",
        },
        id: "existing",
      },
      {
        file: new File(["fresh"], "fresh.txt", { type: "text/plain" }),
        id: "fresh",
      },
    ] satisfies FileWithPreview[];
    const mutations = {
      createPost: vi.fn(async () => postId),
      discardForumUploads: vi.fn(async () => null),
      generateUploadUrl: vi.fn(async () => ({
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(async () => uploadId),
    } satisfies SubmitForumPostInput["mutations"];

    const result = await Effect.runPromise(
      Effect.either(
        submitForumPost({
          files,
          mutations,
          post: {
            body: "with attachment",
            forumId,
            parentId: undefined,
          },
        })
      )
    );

    expect(Either.isRight(result)).toBe(true);
    expect(mutations.generateUploadUrl).toHaveBeenCalledTimes(1);
    expect(mutations.createPost).toHaveBeenCalledWith({
      attachmentUploadIds: [uploadId],
      body: "with attachment",
      forumId,
      parentId: undefined,
    });
  });

  it("discards successful uploads when another attachment upload fails", async () => {
    const successfulUploadId =
      "upload_success" as Id<"schoolClassForumPendingUploads">;
    const files = [
      {
        file: new File(["first"], "first.txt", { type: "text/plain" }),
        id: "first",
      },
      {
        file: new File(["second"], "second.txt", { type: "text/plain" }),
        id: "second",
      },
    ] satisfies FileWithPreview[];
    const mutations = {
      createPost: vi.fn(async () => postId),
      discardForumUploads: vi.fn(async () => null),
      generateUploadUrl: vi
        .fn()
        .mockResolvedValueOnce({
          uploadId: successfulUploadId,
          uploadUrl,
        })
        .mockRejectedValueOnce(new Error("upload URL failed")),
      saveForumUpload: vi.fn(async () => successfulUploadId),
    } satisfies SubmitForumPostInput["mutations"];

    const result = await Effect.runPromise(
      Effect.either(
        submitForumPost({
          files,
          mutations,
          post: {
            body: "",
            forumId,
            parentId: undefined,
          },
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.createPost).not.toHaveBeenCalled();
    expect(mutations.discardForumUploads).toHaveBeenCalledWith({
      uploadIds: [successfulUploadId],
    });
  });

  it("captures cleanup failures without masking storage upload errors", async () => {
    const uploadId = "upload_storage" as Id<"schoolClassForumPendingUploads">;
    const files = [
      {
        file: new File(["storage"], "storage.txt", { type: "text/plain" }),
        id: "storage",
      },
    ] satisfies FileWithPreview[];
    mocks.post.mockReturnValue({
      json: vi.fn(() => Promise.reject("storage failed")),
    });
    const mutations = {
      createPost: vi.fn(async () => postId),
      discardForumUploads: vi.fn(() => Promise.reject("cleanup failed")),
      generateUploadUrl: vi.fn(async () => ({
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(async () => uploadId),
    } satisfies SubmitForumPostInput["mutations"];

    const result = await Effect.runPromise(
      Effect.either(
        submitForumPost({
          files,
          mutations,
          post: {
            body: "",
            forumId,
            parentId: undefined,
          },
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.saveForumUpload).not.toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        _tag: "ForumAttachmentCleanupError",
        cause: "cleanup failed",
      }),
      { source: "forum-upload-discard-single" }
    );
  });

  it("discards the pending upload when metadata save fails", async () => {
    const uploadId = "upload_metadata" as Id<"schoolClassForumPendingUploads">;
    const files = [
      {
        file: new File(["metadata"], "metadata.txt", { type: "text/plain" }),
        id: "metadata",
      },
    ] satisfies FileWithPreview[];
    const mutations = {
      createPost: vi.fn(async () => postId),
      discardForumUploads: vi.fn(async () => null),
      generateUploadUrl: vi.fn(async () => ({
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(() => Promise.reject(new Error("save failed"))),
    } satisfies SubmitForumPostInput["mutations"];

    const result = await Effect.runPromise(
      Effect.either(
        submitForumPost({
          files,
          mutations,
          post: {
            body: "",
            forumId,
            parentId: undefined,
          },
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.discardForumUploads).toHaveBeenCalledWith({
      uploadIds: [uploadId],
    });
    expect(mutations.createPost).not.toHaveBeenCalled();
  });

  it("discards uploaded attachments when creating the post fails", async () => {
    const uploadId = "upload_for_post" as Id<"schoolClassForumPendingUploads">;
    const files = [
      {
        file: new File(["attachment"], "attachment.txt", {
          type: "text/plain",
        }),
        id: "attachment",
      },
    ] satisfies FileWithPreview[];
    const mutations = {
      createPost: vi.fn(() => Promise.reject(new Error("post failed"))),
      discardForumUploads: vi.fn(async () => null),
      generateUploadUrl: vi.fn(async () => ({
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(async () => uploadId),
    } satisfies SubmitForumPostInput["mutations"];

    const result = await Effect.runPromise(
      Effect.either(
        submitForumPost({
          files,
          mutations,
          post: {
            body: "attachment",
            forumId,
            parentId: undefined,
          },
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.discardForumUploads).toHaveBeenCalledWith({
      uploadIds: [uploadId],
    });
  });
});
