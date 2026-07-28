// @vitest-environment node

import { HttpClient, HttpClientResponse } from "@effect/platform";
import type { HttpClientRequest } from "@effect/platform/HttpClientRequest";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import { Effect, Either, FiberRef, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitForumPost } from "./submit";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  request: vi.fn<(request: HttpClientRequest) => void>(),
  response: vi.fn<() => Response>(),
  tracingDisabled: vi.fn<(disabled: boolean) => void>(),
}));

vi.mock("@repo/analytics/posthog", () => ({
  captureException: mocks.captureException,
}));

const forumId = "forum_1" as Id<"schoolClassForums">;
const postId = "post_1" as Id<"schoolClassForumPosts">;
const storageId = "storage_1" as Id<"_storage">;
const settlementToken = "forum-upload-settlement-token";
const uploadUrl = "https://upload.example.test/file?token=signed-upload-secret";

type SubmitForumPostInput = Parameters<typeof submitForumPost>[0];

const TestHttpClient = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.gen(function* () {
      const tracerDisabledWhen = yield* FiberRef.get(
        HttpClient.currentTracerDisabledWhen
      );
      mocks.tracingDisabled(tracerDisabledWhen(request));
      mocks.request(request);
      return HttpClientResponse.fromWeb(request, mocks.response());
    })
  )
);

/** Runs a forum submission with the deterministic test HTTP client. */
function runSubmit(input: SubmitForumPostInput) {
  return Effect.runPromise(
    submitForumPost(input).pipe(Effect.provide(TestHttpClient), Effect.either)
  );
}

/** Builds the default successful Convex mutation set for one submit test. */
function makeMutations(
  overrides: Partial<SubmitForumPostInput["mutations"]> = {}
) {
  return {
    createPost: vi.fn(async () => postId),
    discardForumUploads: vi.fn(async () => null),
    generateUploadUrl: vi.fn(),
    saveForumUpload: vi.fn(),
    ...overrides,
  } satisfies SubmitForumPostInput["mutations"];
}

/** Builds one browser attachment fixture. */
function makeFile(id: string) {
  return {
    file: new File([id], `${id}.txt`, { type: "text/plain" }),
    id,
  } satisfies FileWithPreview;
}

describe("submitForumPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.response.mockReturnValue(
      Response.json({
        storageId,
      })
    );
  });

  it("creates a text-only post without upload mutations", async () => {
    const mutations = makeMutations();

    const result = await runSubmit({
      files: [],
      mutations,
      post: {
        body: "hello",
        forumId,
        parentId: undefined,
      },
    });

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
    const mutations = makeMutations({
      createPost: vi.fn(() => Promise.reject(new Error("post failed"))),
    });

    const result = await runSubmit({
      files: [],
      mutations,
      post: {
        body: "hello",
        forumId,
        parentId: undefined,
      },
    });

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
      makeFile("fresh"),
    ] satisfies FileWithPreview[];
    const mutations = makeMutations({
      generateUploadUrl: vi.fn(async () => ({
        settlementToken,
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(async () => uploadId),
    });

    const result = await runSubmit({
      files,
      mutations,
      post: {
        body: "with attachment",
        forumId,
        parentId: undefined,
      },
    });

    expect(Either.isRight(result)).toBe(true);
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          _tag: "Raw",
          body: files[1]?.file,
        }),
        headers: expect.objectContaining({
          "content-type": "text/plain",
        }),
        method: "POST",
        url: uploadUrl,
      })
    );
    expect(mutations.generateUploadUrl).toHaveBeenCalledTimes(1);
    expect(mutations.saveForumUpload).toHaveBeenCalledWith({
      name: "fresh.txt",
      settlementToken,
      size: 5,
      storageId,
      type: "text/plain",
      uploadId,
    });
    expect(mocks.tracingDisabled).toHaveBeenCalledWith(true);
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
    const files = [makeFile("first"), makeFile("second")];
    const mutations = makeMutations({
      generateUploadUrl: vi
        .fn()
        .mockResolvedValueOnce({
          settlementToken,
          uploadId: successfulUploadId,
          uploadUrl,
        })
        .mockRejectedValueOnce(new Error("upload URL failed")),
      saveForumUpload: vi.fn(async () => successfulUploadId),
    });

    const result = await runSubmit({
      files,
      mutations,
      post: {
        body: "",
        forumId,
        parentId: undefined,
      },
    });

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.createPost).not.toHaveBeenCalled();
    expect(mutations.discardForumUploads).toHaveBeenCalledWith({
      uploadIds: [successfulUploadId],
    });
  });

  it("captures cleanup failures without masking storage upload errors", async () => {
    const uploadId = "upload_storage" as Id<"schoolClassForumPendingUploads">;
    const files = [makeFile("storage")];
    mocks.response.mockReturnValue(
      new Response("storage failed", { status: 500 })
    );
    const mutations = makeMutations({
      discardForumUploads: vi.fn(() => Promise.reject("cleanup failed")),
      generateUploadUrl: vi.fn(async () => ({
        settlementToken,
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(async () => uploadId),
    });

    const result = await runSubmit({
      files,
      mutations,
      post: {
        body: "",
        forumId,
        parentId: undefined,
      },
    });

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      return;
    }
    expect(JSON.stringify(result.left)).not.toContain("signed-upload-secret");
    expect(JSON.stringify(result.left)).not.toContain(settlementToken);
    expect(JSON.stringify(result.left)).not.toContain(uploadUrl);
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
    const files = [makeFile("metadata")];
    const mutations = makeMutations({
      generateUploadUrl: vi.fn(async () => ({
        settlementToken,
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(() => Promise.reject(new Error("save failed"))),
    });

    const result = await runSubmit({
      files,
      mutations,
      post: {
        body: "",
        forumId,
        parentId: undefined,
      },
    });

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.discardForumUploads).toHaveBeenCalledWith({
      uploadIds: [uploadId],
    });
    expect(mutations.createPost).not.toHaveBeenCalled();
  });

  it("discards uploaded attachments when creating the post fails", async () => {
    const uploadId = "upload_for_post" as Id<"schoolClassForumPendingUploads">;
    const files = [makeFile("attachment")];
    const mutations = makeMutations({
      createPost: vi.fn(() => Promise.reject(new Error("post failed"))),
      generateUploadUrl: vi.fn(async () => ({
        settlementToken,
        uploadId,
        uploadUrl,
      })),
      saveForumUpload: vi.fn(async () => uploadId),
    });

    const result = await runSubmit({
      files,
      mutations,
      post: {
        body: "attachment",
        forumId,
        parentId: undefined,
      },
    });

    expect(Either.isLeft(result)).toBe(true);
    expect(mutations.discardForumUploads).toHaveBeenCalledWith({
      uploadIds: [uploadId],
    });
  });
});
