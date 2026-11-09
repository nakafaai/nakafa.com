import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import bucketInternal from "@repo/backend/confect/_generated/refs/bucket.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import { fileValidator } from "@repo/backend/confect/bucket/row";
import { objectAddress } from "@repo/backend/confect/bucket/sign";
import {
  chargeBucket,
  refundBucket,
  spendOperations,
} from "@repo/backend/confect/bucket/use";
import {
  chargeBytes,
  refundBytes,
} from "@repo/backend/confect/classroom/forum/use";
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, Duration, Effect, Option, Schema } from "effect";

/** How long an upload address lives. */
const UPLOAD_SECONDS = 900;

/** How long a read address lives: two hours, signed from the start of the hour, so one query answers one address for an hour. */
const READ_SECONDS = 7200;

/** One hour, the step a read address is signed on. */
const HOUR = Duration.toMillis(Duration.hours(1));

/** What a new file asks for: its size, its type, and the school whose limit it charges, when one does. */
export const FileRequest = Schema.Struct({
  byteSize: fileValidator.fields.byteSize,
  contentType: Schema.String,
  tenantId: Schema.NullOr(Id("tenants")),
});

/**
 * Reserves one file before any byte arrives: one write of the day's free operations, the bucket's limit, and the
 * school's limit when a school pays for it. The file starts `reserved`, under its school's folder or every
 * account's, or under the folder its owner names, which then proves whose upload it is.
 */
export const reserveFile = Effect.fn("bucket.file.reserve")(function* (
  request: typeof FileRequest.Type,
  folder = `files/${request.tenantId ?? "accounts"}`
) {
  yield* spendOperations("bucketWrite", 1);
  yield* chargeBucket(request.byteSize);
  if (
    request.tenantId !== null &&
    !(yield* chargeBytes(request.tenantId, request.byteSize))
  ) {
    return yield* new StorageFull({ reason: "school" });
  }
  const objectKey = `${folder}/${yield* randomUuid}`;
  const fileId = yield* (yield* DatabaseWriter)
    .table("bucketFiles")
    .insert({
      byteSize: request.byteSize,
      contentType: request.contentType,
      createdAt: yield* Clock.currentTimeMillis,
      objectKey,
      state: "reserved",
      ...(request.tenantId === null ? {} : { tenantId: request.tenantId }),
    })
    .pipe(Effect.orDie);
  return { fileId, objectKey };
});

/**
 * Reserves one file a browser uploads, under the folder `reserveFile` names, and answers the address it goes to,
 * which binds its exact length and type.
 */
export const reserveUpload = Effect.fn("bucket.file.reserveUpload")(function* (
  request: typeof FileRequest.Type,
  folder?: string
) {
  const { fileId, objectKey } = yield* reserveFile(request, folder);
  return {
    address: yield* objectAddress(objectKey, {
      expiresSeconds: UPLOAD_SECONDS,
      headers: {
        "content-length": String(request.byteSize),
        "content-type": request.contentType,
      },
      method: "PUT",
    }),
    fileId,
  };
});

/** Deletes one file: its row, its bytes from the school's use and the bucket's, and its object right after. */
export const deleteFile = Effect.fn("bucket.file.delete")(function* (
  fileId: GenericId.GenericId<"bucketFiles">
) {
  const found = yield* (yield* DatabaseReader)
    .table("bucketFiles")
    .get(fileId)
    .pipe(Effect.option);
  if (Option.isNone(found)) {
    return;
  }
  const file = found.value;
  if (file.tenantId !== undefined) {
    yield* refundBytes(file.tenantId, file.byteSize);
  }
  yield* refundBucket(file.byteSize);
  yield* (yield* DatabaseWriter)
    .table("bucketFiles")
    .delete(fileId)
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    bucketInternal.removeObjects,
    { keys: [file.objectKey] }
  );
});

/**
 * The read address of one stored file, signed from the start of the hour for two hours, so every read in that hour
 * answers the same address and a query's cached answer stays valid. A file that is gone or never arrived has none.
 */
export const fileAddress = Effect.fn("bucket.file.address")(function* (
  fileId: GenericId.GenericId<"bucketFiles">
) {
  const found = yield* (yield* DatabaseReader)
    .table("bucketFiles")
    .get(fileId)
    .pipe(Effect.option);
  if (Option.isNone(found) || found.value.state !== "stored") {
    return Option.none<string>();
  }
  return Option.some(yield* readAddress(found.value.objectKey));
});

/** The read address of one object, signed from the start of the hour for two hours. */
export const readAddress = Effect.fn("bucket.file.readAddress")(function* (
  objectKey: string
) {
  const now = yield* Clock.currentTimeMillis;
  return yield* objectAddress(objectKey, {
    expiresSeconds: READ_SECONDS,
    method: "GET",
    signedAt: now - (now % HOUR),
  });
});
