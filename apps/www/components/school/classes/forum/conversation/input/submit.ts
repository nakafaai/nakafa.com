import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/browser";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import { Effect, Result, Schema } from "effect";
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
const ForumPostSubmitDraftSchema = Schema.Struct({
  body: Schema.String,
  forumId: IdSchema("schoolClassForums"),
  parentId: Schema.UndefinedOr(IdSchema("schoolClassForumPosts")),
});
const DiscardPendingUploadsInputSchema = Schema.Struct({
  source: Schema.String,
  uploadIds: Schema.mutable(
    Schema.Array(IdSchema("schoolClassForumPendingUploads"))
  ),
});
const UploadAttachmentFileInputSchema = Schema.Struct({
  file: Schema.instanceOf(File),
  forumId: IdSchema("schoolClassForums"),
});
type ForumPostSubmitDraft = typeof ForumPostSubmitDraftSchema.Type;
type DiscardPendingUploadsInput = typeof DiscardPendingUploadsInputSchema.Type;
type UploadAttachmentFileInput = typeof UploadAttachmentFileInputSchema.Type;
export type GenerateUploadUrlMutation = (
  args: Ref.Args<
    typeof refs.public.classes.forums.mutations.uploads.generateUploadUrl
  >
) => InvokeReturn<
  typeof refs.public.classes.forums.mutations.uploads.generateUploadUrl
>;
export type DiscardForumUploadsMutation = (
  args: Ref.Args<
    typeof refs.public.classes.forums.mutations.uploads.discardForumUploads
  >
) => InvokeReturn<
  typeof refs.public.classes.forums.mutations.uploads.discardForumUploads
>;
export type SaveForumUploadMutation = (
  args: Ref.Args<
    typeof refs.public.classes.forums.mutations.uploads.saveForumUpload
  >
) => InvokeReturn<
  typeof refs.public.classes.forums.mutations.uploads.saveForumUpload
>;
export type CreateForumPostMutation = (
  args: Ref.Args<
    typeof refs.public.classes.forums.mutations.posts.createForumPost
  >
) => InvokeReturn<
  typeof refs.public.classes.forums.mutations.posts.createForumPost
>;

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
  const uploadableFiles: File[] = [];
  for (const fileWithPreview of files) {
    if (fileWithPreview.file instanceof File) {
      uploadableFiles.push(fileWithPreview.file);
    }
  }
  return uploadableFiles;
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
          new ForumAttachmentCleanupError({
            message: "Forum attachment cleanup failed.",
            cause: getErrorCause(cause),
          }),
      }).pipe(
        Effect.flatMap((result) =>
          Effect.fromResult(result).pipe(
            Effect.mapError(
              (cause) =>
                new ForumAttachmentCleanupError({
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
        new ForumAttachmentUploadError({
          message: "Forum attachment upload URL generation failed.",
          cause: getErrorCause(cause),
        }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError(
            (cause) =>
              new ForumAttachmentUploadError({
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
      Effect.mapError(
        () =>
          new ForumAttachmentUploadError({
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
        new ForumAttachmentUploadError({
          message: "Forum attachment metadata save failed.",
          cause: getErrorCause(cause),
        }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError(
            (cause) =>
              new ForumAttachmentUploadError({
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
  const attachmentUploadIds: Id<"schoolClassForumPendingUploads">[] = [];
  const uploadResults = yield* Effect.all(
    getUploadableFiles(files).map((file) =>
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
  for (const result of uploadResults) {
    if (Result.isSuccess(result)) {
      attachmentUploadIds.push(result.success);
    }
  }
  const failedUpload = uploadResults.find(Result.isFailure);
  if (failedUpload) {
    yield* discardPendingUploads({
      mutations,
      source: "forum-upload-discard-batch",
      uploadIds: attachmentUploadIds,
    });
    return yield* failedUpload.failure;
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
      new ForumPostCreateError({
        message: "Forum post creation failed.",
        cause: getErrorCause(cause),
      }),
  }).pipe(
    Effect.flatMap((result) =>
      Effect.fromResult(result).pipe(
        Effect.mapError(
          (cause) =>
            new ForumPostCreateError({
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
