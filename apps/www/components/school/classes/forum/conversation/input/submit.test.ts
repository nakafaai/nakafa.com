// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import { Effect, Layer, Result } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import type { HttpClientRequest } from "effect/unstable/http/HttpClientRequest";
import { vi } from "vitest";
import { submitForumPost } from "./submit";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  request: vi.fn<(request: HttpClientRequest) => void>(),
  response: vi.fn<() => Response>(),
  tracingDisabled: vi.fn<(disabled: boolean) => void>(),
}));
vi.mock("@repo/analytics/posthog/browser", () => ({
  captureException: mocks.captureException,
}));
const forumId = "forum_1" as Id<"schoolClassForums">;
const postId = "post_1" as Id<"schoolClassForumPosts">;
const storageId = "storage_1" as Id<"_storage">;
const uploadUrl = "https://upload.example.test/file?token=signed-upload-secret";
type SubmitForumPostInput = Parameters<typeof submitForumPost>[0];
const TestHttpClient = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.gen(function* () {
      const tracerDisabledWhen = yield* HttpClient.TracerDisabledWhen;
      mocks.tracingDisabled(tracerDisabledWhen(request));
      mocks.request(request);
      return HttpClientResponse.fromWeb(request, mocks.response());
    })
  )
);
/** Runs a forum submission with the deterministic test HTTP client. */
function runSubmit(input: SubmitForumPostInput) {
  return submitForumPost(input).pipe(
    Effect.provide(TestHttpClient),
    Effect.result
  );
}
/** Builds the default successful Convex mutation set for one submit test. */
function makeMutations(
  overrides: Partial<SubmitForumPostInput["mutations"]> = {}
) {
  return {
    createPost: vi.fn(() => Promise.resolve(postId)),
    discardForumUploads: vi.fn(() => Promise.resolve(null)),
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
  it.effect("creates a text-only post without upload mutations", () =>
    Effect.gen(function* () {
      const mutations = makeMutations();
      const result = yield* runSubmit({
        files: [],
        mutations,
        post: {
          body: "hello",
          forumId,
          parentId: undefined,
        },
      });
      expect(Result.isSuccess(result)).toBe(true);
      expect(mutations.createPost).toHaveBeenCalledWith({
        attachmentUploadIds: undefined,
        body: "hello",
        forumId,
        parentId: undefined,
      });
      expect(mutations.generateUploadUrl).not.toHaveBeenCalled();
      expect(mutations.discardForumUploads).not.toHaveBeenCalled();
    })
  );
  it.effect(
    "does not discard pending uploads when a text-only post fails",
    () =>
      Effect.gen(function* () {
        const mutations = makeMutations({
          createPost: vi.fn(() => Promise.reject(new Error("post failed"))),
        });
        const result = yield* runSubmit({
          files: [],
          mutations,
          post: {
            body: "hello",
            forumId,
            parentId: undefined,
          },
        });
        expect(Result.isFailure(result)).toBe(true);
        expect(mutations.discardForumUploads).not.toHaveBeenCalled();
      })
  );
  it.effect("uploads new File objects and ignores existing file metadata", () =>
    Effect.gen(function* () {
      const uploadId =
        "upload_for_file" as Id<"schoolClassForumPendingUploads">;
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
        generateUploadUrl: vi.fn(() =>
          Promise.resolve({ uploadId, uploadUrl })
        ),
        saveForumUpload: vi.fn(() => Promise.resolve(uploadId)),
      });
      const result = yield* runSubmit({
        files,
        mutations,
        post: {
          body: "with attachment",
          forumId,
          parentId: undefined,
        },
      });
      expect(Result.isSuccess(result)).toBe(true);
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
    })
  );
  it.effect(
    "discards successful uploads when another attachment upload fails",
    () =>
      Effect.gen(function* () {
        const successfulUploadId =
          "upload_success" as Id<"schoolClassForumPendingUploads">;
        const files = [makeFile("first"), makeFile("second")];
        const mutations = makeMutations({
          generateUploadUrl: vi
            .fn()
            .mockResolvedValueOnce({
              uploadId: successfulUploadId,
              uploadUrl,
            })
            .mockRejectedValueOnce(new Error("upload URL failed")),
          saveForumUpload: vi.fn(() => Promise.resolve(successfulUploadId)),
        });
        const result = yield* runSubmit({
          files,
          mutations,
          post: {
            body: "",
            forumId,
            parentId: undefined,
          },
        });
        expect(Result.isFailure(result)).toBe(true);
        expect(mutations.createPost).not.toHaveBeenCalled();
        expect(mutations.discardForumUploads).toHaveBeenCalledWith({
          uploadIds: [successfulUploadId],
        });
      })
  );
  it.effect(
    "captures cleanup failures without masking storage upload errors",
    () =>
      Effect.gen(function* () {
        const uploadId =
          "upload_storage" as Id<"schoolClassForumPendingUploads">;
        const files = [makeFile("storage")];
        mocks.response.mockReturnValue(
          new Response("storage failed", { status: 500 })
        );
        const mutations = makeMutations({
          discardForumUploads: vi.fn(() => Promise.reject("cleanup failed")),
          generateUploadUrl: vi.fn(() =>
            Promise.resolve({ uploadId, uploadUrl })
          ),
          saveForumUpload: vi.fn(() => Promise.resolve(uploadId)),
        });
        const result = yield* runSubmit({
          files,
          mutations,
          post: {
            body: "",
            forumId,
            parentId: undefined,
          },
        });
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isSuccess(result)) {
          return;
        }
        expect(JSON.stringify(result.failure)).not.toContain(
          "signed-upload-secret"
        );
        expect(JSON.stringify(result.failure)).not.toContain(uploadUrl);
        expect(mutations.saveForumUpload).not.toHaveBeenCalled();
        expect(mocks.captureException).toHaveBeenCalledWith(
          expect.objectContaining({
            _tag: "ForumAttachmentCleanupError",
            cause: "cleanup failed",
          }),
          { source: "forum-upload-discard-single" }
        );
      })
  );
  it.effect("discards the pending upload when metadata save fails", () =>
    Effect.gen(function* () {
      const uploadId =
        "upload_metadata" as Id<"schoolClassForumPendingUploads">;
      const files = [makeFile("metadata")];
      const mutations = makeMutations({
        generateUploadUrl: vi.fn(() =>
          Promise.resolve({ uploadId, uploadUrl })
        ),
        saveForumUpload: vi.fn(() => Promise.reject(new Error("save failed"))),
      });
      const result = yield* runSubmit({
        files,
        mutations,
        post: {
          body: "",
          forumId,
          parentId: undefined,
        },
      });
      expect(Result.isFailure(result)).toBe(true);
      expect(mutations.discardForumUploads).toHaveBeenCalledWith({
        uploadIds: [uploadId],
      });
      expect(mutations.createPost).not.toHaveBeenCalled();
    })
  );
  it.effect("discards uploaded attachments when creating the post fails", () =>
    Effect.gen(function* () {
      const uploadId =
        "upload_for_post" as Id<"schoolClassForumPendingUploads">;
      const files = [makeFile("attachment")];
      const mutations = makeMutations({
        createPost: vi.fn(() => Promise.reject(new Error("post failed"))),
        generateUploadUrl: vi.fn(() =>
          Promise.resolve({ uploadId, uploadUrl })
        ),
        saveForumUpload: vi.fn(() => Promise.resolve(uploadId)),
      });
      const result = yield* runSubmit({
        files,
        mutations,
        post: {
          body: "attachment",
          forumId,
          parentId: undefined,
        },
      });
      expect(Result.isFailure(result)).toBe(true);
      expect(mutations.discardForumUploads).toHaveBeenCalledWith({
        uploadIds: [uploadId],
      });
    })
  );
});
