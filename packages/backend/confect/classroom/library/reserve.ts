import type { GenericId } from "@confect/core";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import { objectAddress } from "@repo/backend/confect/bucket/sign";
import {
  chargeBucket,
  refundBucket,
  spendOperations,
} from "@repo/backend/confect/bucket/use";
import { FileSizeRefused } from "@repo/backend/confect/classroom/errors";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import {
  chargeBytes,
  refundBytes,
} from "@repo/backend/confect/classroom/forum/use";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import {
  LibraryFileType,
  libraryField,
} from "@repo/backend/confect/classroom/library/item";
import { itemPlace } from "@repo/backend/confect/classroom/library/place";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { sealText } from "@repo/backend/confect/vault/text";
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, Duration, Effect, Option, Schema } from "effect";

/** How long an upload address lives: long enough for 20 MiB on a slow school connection. */
const UPLOAD_SECONDS = 900;

/** How long a reservation waits for its upload before the daily sweep frees its bytes. */
export const RESERVATION_AGE = Duration.hours(2);

/**
 * One library upload that reserved its bytes before any byte arrived: the school's limit and the bucket's were
 * charged, and its object key and its sealed title wait for the upload. The title is sealed under the row the item
 * will be, so registering copies it unchanged.
 */
export const reservationValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
  classId: Id("classes"),
  clientKey: ClientKey,
  contentType: LibraryFileType,
  createdAt: Schema.Finite,
  folderId: Schema.optionalKey(Id("classroomFolders")),
  objectKey: Schema.String,
  sealedTitle: Sealed,
  tenantId: Id("tenants"),
});

/** What one reservation asks for. */
const ReservationRequest = Schema.Struct({
  authorId: Id("tenantPeople"),
  byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
  clientKey: ClientKey,
  contentType: LibraryFileType,
  folderId: Schema.NullOr(Id("classroomFolders")),
  title: Schema.String,
});

/**
 * Reserves the bytes of one upload: a file over the library's limit is refused first, then one write of the day's
 * free operations, then the bucket's limit and the school's. A repeat of a client key answers its reservation and
 * charges nothing.
 */
export const reserveUpload = Effect.fn("classroom.library.reserve")(function* (
  row: ClassesDoc,
  request: typeof ReservationRequest.Type
) {
  if (request.byteSize > LIBRARY_BYTE_LIMIT) {
    return yield* new FileSizeRefused();
  }
  const reader = yield* DatabaseReader;
  const held = yield* reader
    .table("classroomLibraryUploads")
    .index("by_classId_and_clientKey", (query) =>
      query.eq("classId", row._id).eq("clientKey", request.clientKey)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(held)) {
    return held.value;
  }
  yield* spendOperations("bucketWrite", 1);
  yield* chargeBucket(request.byteSize);
  if (!(yield* chargeBytes(row.tenantId, request.byteSize))) {
    return yield* new StorageFull({ reason: "school" });
  }
  const fields = { classId: row._id, clientKey: request.clientKey };
  const id = yield* (yield* DatabaseWriter)
    .table("classroomLibraryUploads")
    .insert({
      ...fields,
      ...(yield* itemPlace(row._id, request.folderId)),
      authorId: request.authorId,
      byteSize: request.byteSize,
      contentType: request.contentType,
      createdAt: yield* Clock.currentTimeMillis,
      objectKey: `library/${row.tenantId}/${yield* randomUuid}`,
      sealedTitle: yield* sealText(
        yield* schoolKeys(row.tenantId),
        libraryField(fields, "sealedTitle"),
        request.title
      ).pipe(Effect.orDie),
      tenantId: row.tenantId,
    })
    .pipe(Effect.orDie);
  return yield* reader
    .table("classroomLibraryUploads")
    .get(id)
    .pipe(Effect.orDie);
});

/** The address one reserved upload goes to, which binds its exact length and type. */
export const uploadAddress = (reservation: typeof reservationValidator.Type) =>
  objectAddress(reservation.objectKey, {
    expiresSeconds: UPLOAD_SECONDS,
    headers: {
      "content-length": String(reservation.byteSize),
      "content-type": reservation.contentType,
    },
    method: "PUT",
  });

/** Frees the bytes of one reservation and deletes its row. The caller removes the object, if one arrived. */
export const releaseUpload = Effect.fn("classroom.library.release")(function* (
  reservationId: GenericId.GenericId<"classroomLibraryUploads">,
  reservation: typeof reservationValidator.Type
) {
  yield* refundBytes(reservation.tenantId, reservation.byteSize);
  yield* refundBucket(reservation.byteSize);
  yield* (yield* DatabaseWriter)
    .table("classroomLibraryUploads")
    .delete(reservationId)
    .pipe(Effect.orDie);
});
