import type { GenericId } from "@confect/core";
import type { ClassroomMessagesDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { UploadGone } from "@repo/backend/confect/classroom/forum/errors";
import type { messageField } from "@repo/backend/confect/classroom/forum/message";
import {
  type PollDraft,
  pollField,
} from "@repo/backend/confect/classroom/forum/poll";
import { refundBytes } from "@repo/backend/confect/classroom/forum/use";
import type { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** The school keys a send seals with. */
type Keys = Effect.Success<ReturnType<typeof schoolKeys>>;

/** The row fields a sealed part of a message binds to. */
type MessageFields = Parameters<typeof messageField>[0];

/**
 * Turns the sender's uploads into the files of the message it sends: each upload
 * leaves its table, and its row moves onto the message. An upload that is gone, or
 * that is not the sender's in this class, stops the send.
 */
export const takeUploads = Effect.fn("classroom.forum.attach.take")(function* (
  uploadIds: readonly GenericId.GenericId<"classroomUploads">[]
) {
  const { person } = yield* Member;
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  return yield* Effect.forEach(Arr.dedupe(uploadIds), (uploadId) =>
    Effect.gen(function* () {
      const upload = yield* reader
        .table("classroomUploads")
        .get(uploadId)
        .pipe(Effect.option);
      if (
        Option.isNone(upload) ||
        upload.value.authorId !== person._id ||
        upload.value.classId !== row._id
      ) {
        return yield* new UploadGone();
      }
      yield* writer
        .table("classroomUploads")
        .delete(uploadId)
        .pipe(Effect.orDie);
      return Struct.omit(upload.value, [
        "_creationTime",
        "_id",
        "authorId",
        "classId",
        "createdAt",
        "tenantId",
      ]);
    })
  );
});

/** The poll of a send with its words sealed under the message's key. */
export const sealPoll = Effect.fn("classroom.forum.attach.poll")(function* (
  keys: Keys,
  fields: MessageFields,
  poll: typeof PollDraft.Type
) {
  return {
    multiple: poll.multiple,
    sealedOptions: yield* Effect.forEach(poll.options, (option, index) =>
      sealText(keys, pollField(fields, `option:${index}`), option).pipe(
        Effect.orDie
      )
    ),
    sealedQuestion: yield* sealText(
      keys,
      pollField(fields, "question"),
      poll.question
    ).pipe(Effect.orDie),
  };
});

/**
 * Deletes everything a hidden message carried: its files, which revokes their
 * addresses (ADR 0028), with their bytes given back to the school, and its tally.
 */
export const dropCarried = Effect.fn("classroom.forum.attach.drop")(function* (
  message: ClassroomMessagesDoc
) {
  const storage = yield* StorageWriter;
  const files = message.attachments ?? [];
  yield* Effect.forEach(
    Arr.flatMap(files, (file) =>
      Arr.appendAll(
        [file.storageId],
        file.thumbnailId === undefined ? [] : [file.thumbnailId]
      )
    ),
    (storageId) => storage.delete(storageId).pipe(Effect.orDie)
  );
  yield* refundBytes(
    message.tenantId,
    Arr.reduce(files, 0, (bytes, file) => bytes + file.byteSize)
  );
  const tally = yield* (yield* DatabaseReader)
    .table("classroomTallies")
    .index("by_messageId", (query) => query.eq("messageId", message._id))
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(tally)) {
    yield* (yield* DatabaseWriter)
      .table("classroomTallies")
      .delete(tally.value._id)
      .pipe(Effect.orDie);
  }
});
