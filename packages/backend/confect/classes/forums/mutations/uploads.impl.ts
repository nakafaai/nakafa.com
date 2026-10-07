import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { loadOpenForumWithAccess } from "@repo/backend/confect/classes/forums/access";
import { FORUM_PENDING_UPLOAD_EXPIRATION_MS } from "@repo/backend/confect/classes/forums/attachments/constants";
import {
  deleteForumPendingUpload,
  validateForumAttachmentPolicy,
  validateForumAttachmentStorageClaim,
  validateStoredForumAttachmentMetadata,
} from "@repo/backend/confect/classes/forums/attachments/impl";
import {
  ForumAttachmentError,
  forumAttachmentMetadataMismatchCode,
} from "@repo/backend/confect/classes/forums/attachments/spec";
import { createForumAttachmentUploadUrl } from "@repo/backend/confect/classes/forums/attachments/upload";
import { MAX_FORUM_POST_ATTACHMENTS } from "@repo/backend/confect/classes/forums/constants";
import spec from "@repo/backend/confect/classes/forums/mutations/uploads.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, DateTime, Effect, Layer } from "effect";

/**
 * Create an upload URL for one new forum post attachment.
 */
const generateUploadUrl = FunctionImpl.make(
  databaseSchema,
  spec,
  "generateUploadUrl",
  Effect.fn("classes.forums.mutations.uploads.generateUploadUrl")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const database = yield* DatabaseReader;
      const user = yield* requireAuth();
      const userId = user.appUser._id;
      const { forum } = yield* loadOpenForumWithAccess(args.forumId, userId);
      const activePendingUploads = yield* database
        .table("schoolClassForumPendingUploads")
        .index("by_forumId_and_uploadedBy", (q) =>
          q.eq("forumId", forum._id).eq("uploadedBy", userId)
        )
        .take(MAX_FORUM_POST_ATTACHMENTS)
        .pipe(Effect.orDie);
      if (activePendingUploads.length >= MAX_FORUM_POST_ATTACHMENTS) {
        return yield* new ForumAttachmentError({
          code: "FORUM_ATTACHMENT_LIMIT_EXCEEDED",
          message: "Forum post attachment count exceeds the supported limit.",
        });
      }
      const uploadToken = yield* randomUuid;
      const createdAt = yield* Clock.currentTimeMillis;
      const expiresAt = createdAt + FORUM_PENDING_UPLOAD_EXPIRATION_MS;
      const uploadId = yield* writer
        .table("schoolClassForumPendingUploads")
        .insert({
          classId: forum.classId,
          expiresAt,
          forumId: forum._id,
          uploadToken,
          uploadedBy: userId,
        })
        .pipe(Effect.orDie);
      yield* (yield* Scheduler).runAt(
        DateTime.makeUnsafe(expiresAt),
        refs.internal.classes.forums.internalMutations
          .deleteExpiredPendingUpload,
        {
          uploadId,
        }
      );
      const uploadUrl = yield* createForumAttachmentUploadUrl(
        uploadId,
        uploadToken
      );
      return {
        uploadId,
        uploadUrl,
      };
    }
  )
);
const saveForumUpload = FunctionImpl.make(
  databaseSchema,
  spec,
  "saveForumUpload",
  Effect.fn("classes.forums.mutations.uploads.saveForumUpload")(
    function* (args) {
      const writer = yield* DatabaseWriter;
      const database = yield* DatabaseReader;
      const upload = yield* database
        .table("schoolClassForumPendingUploads")
        .get(args.uploadId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!upload) {
        return yield* new ForumAttachmentError({
          code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
          message: "Forum post attachment upload not found.",
        });
      }
      const hasBoundStorage = upload.storageId === args.storageId;
      const owner = yield* database
        .table("users")
        .get(upload.uploadedBy)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!owner || isAccountDeletionPending(owner)) {
        if (!hasBoundStorage) {
          return yield* new ForumAttachmentError({
            code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
            message: "Forum post attachment upload not found.",
          });
        }
        yield* deleteForumPendingUpload(upload);
        return args.uploadId;
      }
      if (upload.storageId && !hasBoundStorage) {
        return yield* new ForumAttachmentError({
          code: "FORUM_ATTACHMENT_UPLOAD_ALREADY_SAVED",
          message: "Forum post attachment upload has already been finalized.",
        });
      }
      const user = yield* requireAuth();
      const userId = user.appUser._id;
      if (upload.uploadedBy !== userId) {
        return yield* new ForumAttachmentError({
          code: "FORUM_ATTACHMENT_UPLOAD_NOT_FOUND",
          message: "Forum post attachment upload not found.",
        });
      }
      yield* loadOpenForumWithAccess(upload.forumId, userId);
      if (upload.mimeType !== args.type || upload.size !== args.size) {
        return yield* new ForumAttachmentError({
          code: forumAttachmentMetadataMismatchCode,
          message:
            "Forum post attachment metadata no longer matches the upload.",
        });
      }
      yield* validateForumAttachmentPolicy({
        mimeType: args.type,
        name: args.name,
        size: args.size,
      });
      yield* validateStoredForumAttachmentMetadata({
        size: args.size,
        storageId: args.storageId,
      });
      yield* validateForumAttachmentStorageClaim({
        storageId: args.storageId,
        uploadId: args.uploadId,
      });
      if (hasBoundStorage && upload.name === args.name) {
        return upload._id;
      }
      yield* writer
        .table("schoolClassForumPendingUploads")
        .patch(args.uploadId, {
          mimeType: args.type,
          name: args.name,
          size: args.size,
          storageId: args.storageId,
        })
        .pipe(Effect.orDie);
      return args.uploadId;
    }
  )
);
const discardForumUploads = FunctionImpl.make(
  databaseSchema,
  spec,
  "discardForumUploads",
  Effect.fn("classes.forums.mutations.uploads.discardForumUploads")(
    function* (args) {
      const database = yield* DatabaseReader;
      const user = yield* requireAuth();
      const userId = user.appUser._id;
      for (const uploadId of args.uploadIds) {
        const upload = yield* database
          .table("schoolClassForumPendingUploads")
          .get(uploadId)
          .pipe(
            Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
            Effect.orDie
          );
        if (!upload || upload.uploadedBy !== userId) {
          continue;
        }
        yield* deleteForumPendingUpload(upload);
      }
      return null;
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(generateUploadUrl),
  Layer.provide(saveForumUpload),
  Layer.provide(discardForumUploads),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
