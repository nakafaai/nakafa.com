import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/browser";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type classes from "@repo/backend/confect/_generated/refs/classes";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import {
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";

const STORAGE_UPLOAD_TIMEOUT = "10 seconds";
const StorageIdSchema = Schema.declare(
  (input): input is Id<"_storage"> =>
    typeof input === "string" && input.length > 0,
  {
    identifier: "ConvexStorageId",
  }
);
const StorageUploadResponseSchema = Schema.Struct({
  storageId: StorageIdSchema,
});
const ForumIdSchema = IdSchema("schoolClassForums");
const ForumPostIdSchema = IdSchema("schoolClassForumPosts");
const ForumPendingUploadIdSchema = IdSchema("schoolClassForumPendingUploads");
const ForumPostSubmitDraftSchema = Schema.Struct({
  body: Schema.String,
  forumId: ForumIdSchema,
  parentId: Schema.UndefinedOr(ForumPostIdSchema),
});
type ForumPostSubmitDraft = typeof ForumPostSubmitDraftSchema.Type;
const DiscardPendingUploadsInputSchema = Schema.Struct({
  source: Schema.String,
  uploadIds: Schema.mutable(Schema.Array(ForumPendingUploadIdSchema)),
});
type DiscardPendingUploadsInput = typeof DiscardPendingUploadsInputSchema.Type;
const UploadAttachmentFileInputSchema = Schema.Struct({
  file: Schema.instanceOf(File),
  forumId: ForumIdSchema,
});
type UploadAttachmentFileInput = typeof UploadAttachmentFileInputSchema.Type;
type GenerateUploadUrlMutation = (
  args: Ref.Args<typeof classes.forums.mutations.uploads.generateUploadUrl>
) => InvokeReturn<typeof classes.forums.mutations.uploads.generateUploadUrl>;
type DiscardForumUploadsMutation = (
  args: Ref.Args<typeof classes.forums.mutations.uploads.discardForumUploads>
) => InvokeReturn<typeof classes.forums.mutations.uploads.discardForumUploads>;
type SaveForumUploadMutation = (
  args: Ref.Args<typeof classes.forums.mutations.uploads.saveForumUpload>
) => InvokeReturn<typeof classes.forums.mutations.uploads.saveForumUpload>;
type CreateForumPostMutation = (
  args: Ref.Args<typeof classes.forums.mutations.posts.createForumPost>
) => InvokeReturn<typeof classes.forums.mutations.posts.createForumPost>;
class ForumAttachmentUploadError extends Schema.TaggedError<ForumAttachmentUploadError>()(
  "ForumAttachmentUploadError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  }
) {}
class ForumAttachmentCleanupError extends Schema.TaggedError<ForumAttachmentCleanupError>()(
  "ForumAttachmentCleanupError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  }
) {}
class ForumPostCreateError extends Schema.TaggedError<ForumPostCreateError>()(
  "ForumPostCreateError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  }
) {}
/** Converts unknown failures into a stable serializable error cause. */
function getErrorCause(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
/** Returns only browser File objects that can be uploaded for a new post. */
function getUploadableFiles(files: readonly FileWithPreview[]) {
  return Arr.flatMap(files, (fileWithPreview) =>
    fileWithPreview.file instanceof File ? [fileWithPreview.file] : []
  );
}
/** Discards pending uploads and captures cleanup failures without masking the original error. */
const discardPendingUploads = Effect.fn("www.forum.discardPendingUploads")(
  function* ({
    mutations,
    source,
    uploadIds,
  }: DiscardPendingUploadsInput & {
    mutations: { discardForumUploads: DiscardForumUploadsMutation };
  }) {
    if (uploadIds.length === 0) {
      return;
    }
    const result = yield* Effect.result(
      Effect.tryPromise({
        try: () =>
          mutations.discardForumUploads({
            uploadIds,
          }),
        catch: (cause) =>
          ForumAttachmentCleanupError.make({
            message: "Forum attachment cleanup failed.",
            cause: getErrorCause(cause),
          }),
      }).pipe(
        Effect.flatMap((result) =>
          Effect.fromResult(result).pipe(
            Effect.mapError((cause) =>
              ForumAttachmentCleanupError.make({
                message: "Forum attachment cleanup failed.",
                cause: getErrorCause(cause),
              })
            )
          )
        )
      )
    );
    if (Result.isFailure(result)) {
      yield* Effect.sync(() =>
        captureException(result.failure, {
          source,
        })
      );
    }
  }
);
/** Uploads one attachment and removes its pending record if the upload fails. */
const uploadAttachmentFile = Effect.fn("www.forum.uploadAttachmentFile")(
  function* ({
    file,
    forumId,
    mutations,
  }: UploadAttachmentFileInput & {
    mutations: {
      discardForumUploads: DiscardForumUploadsMutation;
      generateUploadUrl: GenerateUploadUrlMutation;
      saveForumUpload: SaveForumUploadMutation;
    };
  }) {
    const { uploadId, uploadUrl } = yield* Effect.tryPromise({
      try: () =>
        mutations.generateUploadUrl({
          forumId,
        }),
      catch: (cause) =>
        ForumAttachmentUploadError.make({
          message: "Forum attachment upload URL generation failed.",
          cause: getErrorCause(cause),
        }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError((cause) =>
            ForumAttachmentUploadError.make({
              message: "Forum attachment upload URL generation failed.",
              cause: getErrorCause(cause),
            })
          )
        )
      )
    );
    const client = yield* HttpClient.HttpClient;
    const { storageId } = yield* HttpClientRequest.post(uploadUrl).pipe(
      HttpClientRequest.setBody(
        HttpBody.raw(file, {
          contentType: file.type,
        })
      ),
      client.execute,
      Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(StorageUploadResponseSchema)
      ),
      Effect.timeout(STORAGE_UPLOAD_TIMEOUT),
      Effect.mapError(() =>
        ForumAttachmentUploadError.make({
          message: "Forum attachment storage upload failed.",
        })
      ),
      Effect.tapError(() =>
        discardPendingUploads({
          mutations,
          source: "forum-upload-discard-single",
          uploadIds: [uploadId],
        })
      )
    );
    yield* Effect.tryPromise({
      try: () =>
        mutations.saveForumUpload({
          name: file.name,
          size: file.size,
          type: file.type,
          storageId,
          uploadId,
        }),
      catch: (cause) =>
        ForumAttachmentUploadError.make({
          message: "Forum attachment metadata save failed.",
          cause: getErrorCause(cause),
        }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError((cause) =>
            ForumAttachmentUploadError.make({
              message: "Forum attachment metadata save failed.",
              cause: getErrorCause(cause),
            })
          )
        )
      ),
      Effect.tapError(() =>
        discardPendingUploads({
          mutations,
          source: "forum-upload-discard-single",
          uploadIds: [uploadId],
        })
      )
    );
    return uploadId;
  }
);
/** Uploads attachments, creates the post, and cleans partial uploads on failure. */
export const submitForumPost = Effect.fn("www.forum.submitPost")(function* ({
  files,
  mutations,
  post,
}: {
  files: readonly FileWithPreview[];
  mutations: {
    createPost: CreateForumPostMutation;
    discardForumUploads: DiscardForumUploadsMutation;
    generateUploadUrl: GenerateUploadUrlMutation;
    saveForumUpload: SaveForumUploadMutation;
  };
  post: ForumPostSubmitDraft;
}) {
  const uploadResults = yield* Effect.all(
    Arr.map(getUploadableFiles(files), (file) =>
      uploadAttachmentFile({
        file,
        forumId: post.forumId,
        mutations,
      })
    ),
    {
      mode: "result",
    }
  );
  const attachmentUploadIds: Id<"schoolClassForumPendingUploads">[] =
    Arr.flatMap(uploadResults, (result) =>
      Result.isSuccess(result) ? [result.success] : []
    );
  const failedUpload = Arr.findFirst(uploadResults, Result.isFailure);
  if (Option.isSome(failedUpload)) {
    yield* discardPendingUploads({
      mutations,
      source: "forum-upload-discard-batch",
      uploadIds: attachmentUploadIds,
    });
    return yield* failedUpload.value.failure;
  }
  yield* Effect.tryPromise({
    try: () =>
      mutations.createPost({
        ...(attachmentUploadIds.length > 0
          ? {
              attachmentUploadIds,
            }
          : {}),
        forumId: post.forumId,
        body: post.body,
        ...(post.parentId === undefined
          ? {}
          : {
              parentId: post.parentId,
            }),
      }),
    catch: (cause) =>
      ForumPostCreateError.make({
        message: "Forum post creation failed.",
        cause: getErrorCause(cause),
      }),
  }).pipe(
    Effect.flatMap((result) =>
      Effect.fromResult(result).pipe(
        Effect.mapError((cause) =>
          ForumPostCreateError.make({
            message: "Forum post creation failed.",
            cause: getErrorCause(cause),
          })
        )
      )
    ),
    Effect.tapError(() =>
      discardPendingUploads({
        mutations,
        source: "forum-upload-discard-batch",
        uploadIds: attachmentUploadIds,
      })
    )
  );
});
