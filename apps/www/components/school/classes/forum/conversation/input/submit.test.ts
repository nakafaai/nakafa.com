// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { SessionRequired } from "@repo/backend/confect/auth/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import { Effect, Layer, Result, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import type { HttpClientRequest } from "effect/http/HttpClientRequest";
import {
  type CreateForumPostMutation,
  type DiscardForumUploadsMutation,
  type GenerateUploadUrlMutation,
  type SaveForumUploadMutation,
  submitForumPost,
} from "@/components/school/classes/forum/conversation/input/submit";

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
const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
type SubmitForumPostDraft = Parameters<typeof submitForumPost>[0];
type SubmitMutations = ReturnType<typeof makeDefaultMutations>;
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
function runSubmit(
  post: SubmitForumPostDraft,
  files: readonly FileWithPreview[],
  mutations: SubmitMutations
) {
  return submitForumPost(
    post,
    files,
    mutations.createPost,
    mutations.discardForumUploads,
    mutations.generateUploadUrl,
    mutations.saveForumUpload
  ).pipe(Effect.provide(TestHttpClient), Effect.result);
}
/** Builds the default successful Convex mutation doubles for one submit test. */
function makeDefaultMutations() {
  return {
    createPost: vi.fn<CreateForumPostMutation>(() =>
      Promise.resolve(Result.succeed(postId))
    ),
    discardForumUploads: vi.fn<DiscardForumUploadsMutation>(() =>
      Promise.resolve(Result.succeed(null))
    ),
    generateUploadUrl: vi.fn<GenerateUploadUrlMutation>(),
    saveForumUpload: vi.fn<SaveForumUploadMutation>(),
  };
}
/** Builds the Convex mutation doubles for one submit test, with per-test overrides. */
function makeMutations(overrides: Partial<SubmitMutations> = {}) {
  return {
    ...makeDefaultMutations(),
    ...overrides,
  };
}
/** Builds one browser attachment fixture. */
function makeFile(id: string) {
  return {
    file: new File([id], `${id}.txt`, {
      type: "text/plain",
    }),
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
  it.effect.each(["url", "save", "create", "cleanup"] as const)(
    "keeps a declared %s failure in the upload cleanup protocol",
    (stage) =>
      Effect.gen(function* () {
        const rejected = new SessionRequired({
          code: "UNAUTHENTICATED",
          message: "Unauthenticated",
        });
        const uploadId =
          "upload_native" as Id<"schoolClassForumPendingUploads">;
        const mutations = makeMutations({
          generateUploadUrl: vi.fn<GenerateUploadUrlMutation>(async () =>
            stage === "url"
              ? Result.fail(rejected)
              : Result.succeed({ uploadId, uploadUrl })
          ),
          saveForumUpload: vi.fn<SaveForumUploadMutation>(async () =>
            stage === "save" ? Result.fail(rejected) : Result.succeed(uploadId)
          ),
          createPost: vi.fn<CreateForumPostMutation>(async () =>
            stage === "create" ? Result.fail(rejected) : Result.succeed(postId)
          ),
          discardForumUploads: vi.fn<DiscardForumUploadsMutation>(async () =>
            stage === "cleanup" ? Result.fail(rejected) : Result.succeed(null)
          ),
        });
        if (stage === "cleanup") {
          mocks.response.mockReturnValue(new Response(null, { status: 503 }));
        }
        const result = yield* runSubmit(
          { body: "Keep the draft", forumId, parentId: undefined },
          [makeFile("native")],
          mutations
        );
        expect(Result.isFailure(result)).toBe(true);
        if (stage !== "create") {
          expect(mutations.createPost).not.toHaveBeenCalled();
        }
        if (stage === "url") {
          expect(mutations.discardForumUploads).not.toHaveBeenCalled();
        } else {
          expect(mutations.discardForumUploads).toHaveBeenCalledWith({
            uploadIds: [uploadId],
          });
        }
        if (stage === "cleanup") {
          expect(mocks.captureException).toHaveBeenCalledWith(
            expect.objectContaining({ _tag: "ForumAttachmentCleanupError" }),
            expect.anything()
          );
        }
      })
  );
  it.effect.each([undefined, postId])(
    "creates a text-only post with parent %s without uploads",
    (parentId) =>
      Effect.gen(function* () {
        const mutations = makeMutations();
        const result = yield* runSubmit(
          { body: "hello", forumId, parentId },
          [],
          mutations
        );
        expect(Result.isSuccess(result)).toBe(true);
        expect(vi.mocked(mutations.createPost).mock.calls).toStrictEqual([
          [
            {
              body: "hello",
              forumId,
              ...(parentId === undefined
                ? {}
                : {
                    parentId,
                  }),
            },
          ],
        ]);
        expect(mutations.generateUploadUrl).not.toHaveBeenCalled();
        expect(mutations.discardForumUploads).not.toHaveBeenCalled();
      })
  );
  it.effect(
    "does not discard pending uploads when a text-only post fails",
    () =>
      Effect.gen(function* () {
        const mutations = makeMutations({
          createPost: vi.fn<CreateForumPostMutation>(() =>
            Promise.reject(new Error("post failed"))
          ),
        });
        const result = yield* runSubmit(
          { body: "hello", forumId, parentId: undefined },
          [],
          mutations
        );
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
        generateUploadUrl: vi.fn<GenerateUploadUrlMutation>(() =>
          Promise.resolve(
            Result.succeed({
              uploadId,
              uploadUrl,
            })
          )
        ),
        saveForumUpload: vi.fn<SaveForumUploadMutation>(() =>
          Promise.resolve(Result.succeed(uploadId))
        ),
      });
      const result = yield* runSubmit(
        { body: "with attachment", forumId, parentId: undefined },
        files,
        mutations
      );
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
            .fn<GenerateUploadUrlMutation>()
            .mockResolvedValueOnce(
              Result.succeed({
                uploadId: successfulUploadId,
                uploadUrl,
              })
            )
            .mockRejectedValueOnce(new Error("upload URL failed")),
          saveForumUpload: vi.fn<SaveForumUploadMutation>(() =>
            Promise.resolve(Result.succeed(successfulUploadId))
          ),
        });
        const result = yield* runSubmit(
          { body: "", forumId, parentId: undefined },
          files,
          mutations
        );
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
          new Response("storage failed", {
            status: 500,
          })
        );
        const mutations = makeMutations({
          discardForumUploads: vi.fn<DiscardForumUploadsMutation>(() =>
            Promise.reject("cleanup failed")
          ),
          generateUploadUrl: vi.fn<GenerateUploadUrlMutation>(() =>
            Promise.resolve(
              Result.succeed({
                uploadId,
                uploadUrl,
              })
            )
          ),
          saveForumUpload: vi.fn<SaveForumUploadMutation>(() =>
            Promise.resolve(Result.succeed(uploadId))
          ),
        });
        const result = yield* runSubmit(
          { body: "", forumId, parentId: undefined },
          files,
          mutations
        );
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isSuccess(result)) {
          return;
        }
        expect(toJson(result.failure)).not.toContain("signed-upload-secret");
        expect(toJson(result.failure)).not.toContain(uploadUrl);
        expect(mutations.saveForumUpload).not.toHaveBeenCalled();
        expect(mocks.captureException).toHaveBeenCalledWith(
          expect.objectContaining({
            _tag: "ForumAttachmentCleanupError",
            cause: "cleanup failed",
          }),
          {
            source: "forum-upload-discard-single",
          }
        );
      })
  );
  it.effect("discards the pending upload when metadata save fails", () =>
    Effect.gen(function* () {
      const uploadId =
        "upload_metadata" as Id<"schoolClassForumPendingUploads">;
      const files = [makeFile("metadata")];
      const mutations = makeMutations({
        generateUploadUrl: vi.fn<GenerateUploadUrlMutation>(() =>
          Promise.resolve(
            Result.succeed({
              uploadId,
              uploadUrl,
            })
          )
        ),
        saveForumUpload: vi.fn<SaveForumUploadMutation>(() =>
          Promise.reject(new Error("save failed"))
        ),
      });
      const result = yield* runSubmit(
        { body: "", forumId, parentId: undefined },
        files,
        mutations
      );
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
        createPost: vi.fn<CreateForumPostMutation>(() =>
          Promise.reject(new Error("post failed"))
        ),
        generateUploadUrl: vi.fn<GenerateUploadUrlMutation>(() =>
          Promise.resolve(
            Result.succeed({
              uploadId,
              uploadUrl,
            })
          )
        ),
        saveForumUpload: vi.fn<SaveForumUploadMutation>(() =>
          Promise.resolve(Result.succeed(uploadId))
        ),
      });
      const result = yield* runSubmit(
        { body: "attachment", forumId, parentId: undefined },
        files,
        mutations
      );
      expect(Result.isFailure(result)).toBe(true);
      expect(mutations.discardForumUploads).toHaveBeenCalledWith({
        uploadIds: [uploadId],
      });
    })
  );
});
