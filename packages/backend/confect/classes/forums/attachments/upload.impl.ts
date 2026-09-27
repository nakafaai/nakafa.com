import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { FORUM_PENDING_UPLOAD_LEASE_MS } from "@repo/backend/confect/classes/forums/attachments/constants";
import spec from "@repo/backend/confect/classes/forums/attachments/upload.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, Layer } from "effect";

const claim = FunctionImpl.make(
  databaseSchema,
  spec,
  "claim",
  Effect.fn("classes.forums.attachments.upload.claim")(function* (args) {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    const ctx = yield* MutationCtxService;
    const claimedAt = yield* Clock.currentTimeMillis;
    const uploadId = ctx.db.normalizeId(
      "schoolClassForumPendingUploads",
      args.uploadId
    );
    if (!uploadId) {
      return false;
    }
    const upload = yield* database
      .table("schoolClassForumPendingUploads")
      .get(uploadId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !upload ||
      upload.uploadToken !== args.uploadToken ||
      upload.expiresAt <= claimedAt ||
      upload.storageId ||
      (upload.uploadLease?.expiresAt ?? 0) > claimedAt
    ) {
      return false;
    }
    const owner = yield* database
      .table("users")
      .get(upload.uploadedBy)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!owner || isAccountDeletionPending(owner)) {
      return false;
    }
    yield* writer
      .table("schoolClassForumPendingUploads")
      .patch(upload._id, {
        uploadLease: {
          expiresAt: Math.min(
            upload.expiresAt,
            claimedAt + FORUM_PENDING_UPLOAD_LEASE_MS
          ),
          id: args.leaseId,
        },
      })
      .pipe(Effect.orDie);
    return true;
  })
);
const release = FunctionImpl.make(
  databaseSchema,
  spec,
  "release",
  Effect.fn("classes.forums.attachments.upload.release")(function* (args) {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    const ctx = yield* MutationCtxService;
    const uploadId = ctx.db.normalizeId(
      "schoolClassForumPendingUploads",
      args.uploadId
    );
    if (!uploadId) {
      return null;
    }
    const upload = yield* database
      .table("schoolClassForumPendingUploads")
      .get(uploadId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (upload?.uploadLease?.id === args.leaseId) {
      yield* writer
        .table("schoolClassForumPendingUploads")
        .patch(upload._id, {
          uploadLease: undefined,
        })
        .pipe(Effect.orDie);
    }
    return null;
  })
);
const settle = FunctionImpl.make(
  databaseSchema,
  spec,
  "settle",
  Effect.fn("classes.forums.attachments.upload.settle")(function* (args) {
    const writer = yield* DatabaseWriter;
    const database = yield* DatabaseReader;
    const ctx = yield* MutationCtxService;
    const settledAt = yield* Clock.currentTimeMillis;
    const uploadId = ctx.db.normalizeId(
      "schoolClassForumPendingUploads",
      args.uploadId
    );
    if (!uploadId) {
      yield* (yield* StorageWriter).delete(args.storageId).pipe(Effect.orDie);
      return "rejected";
    }
    const upload = yield* database
      .table("schoolClassForumPendingUploads")
      .get(uploadId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !upload ||
      upload.uploadToken !== args.uploadToken ||
      upload.storageId
    ) {
      yield* (yield* StorageWriter).delete(args.storageId).pipe(Effect.orDie);
      return "rejected";
    }
    if (upload.expiresAt <= settledAt) {
      yield* (yield* StorageWriter).delete(args.storageId).pipe(Effect.orDie);
      yield* writer.table("schoolClassForumPendingUploads").delete(upload._id);
      return "rejected";
    }
    if (
      upload.uploadLease?.id !== args.leaseId ||
      upload.uploadLease.expiresAt <= settledAt
    ) {
      yield* (yield* StorageWriter).delete(args.storageId).pipe(Effect.orDie);
      return "rejected";
    }
    const owner = yield* database
      .table("users")
      .get(upload.uploadedBy)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!owner || isAccountDeletionPending(owner)) {
      yield* (yield* StorageWriter).delete(args.storageId).pipe(Effect.orDie);
      yield* writer.table("schoolClassForumPendingUploads").delete(upload._id);
      return "discarded";
    }
    yield* writer
      .table("schoolClassForumPendingUploads")
      .patch(upload._id, {
        mimeType: args.contentType,
        size: args.size,
        storageId: args.storageId,
        uploadLease: undefined,
      })
      .pipe(Effect.orDie);
    return "accepted";
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(claim),
  Layer.provide(release),
  Layer.provide(settle),
  Layer.provide(atomic),
  GroupImpl.finalize
);
