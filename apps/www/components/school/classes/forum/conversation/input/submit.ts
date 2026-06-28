import { captureException } from "@repo/analytics/posthog";
import type { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileWithPreview } from "@repo/design-system/hooks/use-file-upload";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Either, Schema } from "effect";
import ky from "ky";

type GenerateUploadUrlMutation = (
  args: FunctionArgs<
    typeof api.classes.forums.mutations.uploads.generateUploadUrl
  >
) => Promise<
  FunctionReturnType<
    typeof api.classes.forums.mutations.uploads.generateUploadUrl
  >
>;

type DiscardForumUploadsMutation = (
  args: FunctionArgs<
    typeof api.classes.forums.mutations.uploads.discardForumUploads
  >
) => Promise<
  FunctionReturnType<
    typeof api.classes.forums.mutations.uploads.discardForumUploads
  >
>;

type SaveForumUploadMutation = (
  args: FunctionArgs<
    typeof api.classes.forums.mutations.uploads.saveForumUpload
  >
) => Promise<
  FunctionReturnType<
    typeof api.classes.forums.mutations.uploads.saveForumUpload
  >
>;

type CreateForumPostMutation = (
  args: FunctionArgs<typeof api.classes.forums.mutations.posts.createForumPost>
) => Promise<
  FunctionReturnType<typeof api.classes.forums.mutations.posts.createForumPost>
>;

interface ForumPostSubmitMutations {
  createPost: CreateForumPostMutation;
  discardForumUploads: DiscardForumUploadsMutation;
  generateUploadUrl: GenerateUploadUrlMutation;
  saveForumUpload: SaveForumUploadMutation;
}

interface ForumPostSubmitDraft {
  body: string;
  forumId: Id<"schoolClassForums">;
  parentId: Id<"schoolClassForumPosts"> | undefined;
}

interface ForumPostSubmitInput {
  files: readonly FileWithPreview[];
  mutations: ForumPostSubmitMutations;
  post: ForumPostSubmitDraft;
}

interface DiscardPendingUploadsInput {
  mutations: Pick<ForumPostSubmitMutations, "discardForumUploads">;
  source: string;
  uploadIds: Id<"schoolClassForumPendingUploads">[];
}

interface UploadAttachmentFileInput {
  file: File;
  forumId: Id<"schoolClassForums">;
  mutations: Pick<
    ForumPostSubmitMutations,
    "discardForumUploads" | "generateUploadUrl" | "saveForumUpload"
  >;
}

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
  function* ({ mutations, source, uploadIds }: DiscardPendingUploadsInput) {
    if (uploadIds.length === 0) {
      return;
    }

    const result = yield* Effect.either(
      Effect.tryPromise({
        try: () => mutations.discardForumUploads({ uploadIds }),
        catch: (cause) =>
          new ForumAttachmentCleanupError({
            message: "Forum attachment cleanup failed.",
            cause: getErrorCause(cause),
          }),
      })
    );

    if (Either.isLeft(result)) {
      yield* Effect.sync(() =>
        captureException(result.left, {
          source,
        })
      );
    }
  }
);

/** Uploads one attachment and removes its pending record if the upload fails. */
const uploadAttachmentFile = Effect.fn("www.forum.uploadAttachmentFile")(
  function* ({ file, forumId, mutations }: UploadAttachmentFileInput) {
    const { uploadId, uploadUrl } = yield* Effect.tryPromise({
      try: () => mutations.generateUploadUrl({ forumId }),
      catch: (cause) =>
        new ForumAttachmentUploadError({
          message: "Forum attachment upload URL generation failed.",
          cause: getErrorCause(cause),
        }),
    });

    const { storageId } = yield* Effect.tryPromise({
      try: () =>
        ky
          .post(uploadUrl, {
            headers: { "Content-Type": file.type },
            body: file,
          })
          .json<{ storageId: Id<"_storage"> }>(),
      catch: (cause) =>
        new ForumAttachmentUploadError({
          message: "Forum attachment storage upload failed.",
          cause: getErrorCause(cause),
        }),
    }).pipe(
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
}: ForumPostSubmitInput) {
  const attachmentUploadIds: Id<"schoolClassForumPendingUploads">[] = [];
  const uploadResults = yield* Effect.all(
    getUploadableFiles(files).map((file) =>
      uploadAttachmentFile({
        file,
        forumId: post.forumId,
        mutations,
      })
    ),
    { mode: "either" }
  );

  for (const result of uploadResults) {
    if (Either.isRight(result)) {
      attachmentUploadIds.push(result.right);
    }
  }

  const failedUpload = uploadResults.find(Either.isLeft);

  if (failedUpload) {
    yield* discardPendingUploads({
      mutations,
      source: "forum-upload-discard-batch",
      uploadIds: attachmentUploadIds,
    });

    return yield* Effect.fail(failedUpload.left);
  }

  yield* Effect.tryPromise({
    try: () =>
      mutations.createPost({
        attachmentUploadIds:
          attachmentUploadIds.length > 0 ? attachmentUploadIds : undefined,
        forumId: post.forumId,
        body: post.body,
        parentId: post.parentId,
      }),
    catch: (cause) =>
      new ForumPostCreateError({
        message: "Forum post creation failed.",
        cause: getErrorCause(cause),
      }),
  }).pipe(
    Effect.tapError(() =>
      discardPendingUploads({
        mutations,
        source: "forum-upload-discard-batch",
        uploadIds: attachmentUploadIds,
      })
    )
  );
});
