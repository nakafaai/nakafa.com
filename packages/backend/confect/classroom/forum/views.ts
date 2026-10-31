import type { GenericId } from "@confect/core";
import type {
  ClassroomMessagesDoc,
  ClassroomThreadsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { attachmentField } from "@repo/backend/confect/classroom/forum/attachment";
import { readMark } from "@repo/backend/confect/classroom/forum/mark";
import {
  type MentionView,
  mentionedPeople,
} from "@repo/backend/confect/classroom/forum/mention";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import {
  type PollView,
  pollField,
} from "@repo/backend/confect/classroom/forum/poll";
import { titleField } from "@repo/backend/confect/classroom/forum/thread";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Option } from "effect";

/** The keys of the school of a class, which seal and open its forum. A school without keys is a defect. */
export const schoolKeys = (tenantId: GenericId.GenericId<"tenants">) =>
  readTenantKeys(tenantId).pipe(Effect.orDie);

/**
 * A discussion as the viewer sees it: its title opened with the school key, and
 * unread when a reply came after the viewer's read mark in it. A discussion the
 * viewer never opened is unread once it holds a reply.
 */
export const discussionView = Effect.fn("classroom.forum.views.discussion")(
  function* (thread: ClassroomThreadsDoc) {
    const { person } = yield* Member;
    const keys = yield* schoolKeys(thread.tenantId);
    const mark = yield* readMark(person._id, {
      channelId: thread.channelId,
      threadId: thread._id,
    });
    const lastReplyAt = thread.lastReplyAt ?? null;
    return {
      lastReplyAt,
      number: thread.number,
      replies: thread.replies,
      title: yield* openText(keys, titleField(thread), thread.sealedTitle).pipe(
        Effect.orDie
      ),
      unread:
        lastReplyAt !== null &&
        Option.match(mark, {
          onNone: () => true,
          onSome: (found) => lastReplyAt > found.at,
        }),
    };
  }
);

/** The keys a school's forum opens with. */
type SchoolKeys = Effect.Success<ReturnType<typeof schoolKeys>>;

/**
 * The files of a message for the viewer: each name opened with the school key,
 * and each address read for this read alone (ADR 0028). A file the storage no
 * longer holds shows without an address.
 */
const attachmentViews = Effect.fn("classroom.forum.views.attachments")(
  function* (message: ClassroomMessagesDoc, keys: SchoolKeys) {
    const storage = yield* StorageReader;
    const addressOf = (storageId: GenericId.GenericId<"_storage">) =>
      storage.getUrl(storageId).pipe(
        Effect.map((url) => url.href),
        Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null))
      );
    return yield* Effect.forEach(message.attachments ?? [], (file) =>
      Effect.gen(function* () {
        const name = yield* openText(
          keys,
          attachmentField({
            classId: message.classId,
            storageId: file.storageId,
          }),
          file.sealedName
        );
        return {
          address: yield* addressOf(file.storageId),
          byteSize: file.byteSize,
          height: file.height ?? null,
          kind: file.kind,
          name,
          thumbnail:
            file.thumbnailId === undefined
              ? null
              : yield* addressOf(file.thumbnailId),
          width: file.width ?? null,
        };
      })
    );
  }
);

/** The poll of a message for the viewer, its words opened with the school key. */
const pollView = Effect.fn("classroom.forum.views.poll")(function* (
  message: ClassroomMessagesDoc,
  keys: SchoolKeys
) {
  const { poll } = message;
  if (poll === undefined) {
    return null;
  }
  const view: typeof PollView.Type = {
    multiple: poll.multiple,
    options: yield* Effect.forEach(poll.sealedOptions, (sealed, index) =>
      openText(keys, pollField(message, `option:${index}`), sealed)
    ),
    question: yield* openText(
      keys,
      pollField(message, "question"),
      poll.sealedQuestion
    ),
  };
  return view;
});

/**
 * The views of some messages for the viewer: each text opened with the school
 * key, each author's name read once, a hidden message without its text, a message
 * that opens a discussion with that discussion, and each message's files and poll.
 */
export const messageViews = Effect.fn("classroom.forum.views.messages")(
  function* (rows: readonly ClassroomMessagesDoc[]) {
    const { person } = yield* Member;
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const keys = yield* schoolKeys(row.tenantId);
    // The authors and the mentioned Persons of the page, each read once. A mentioned
    // Person who is gone is left out of its message's mentions.
    const people = yield* Effect.forEach(
      Arr.dedupe(
        Arr.appendAll(
          Arr.map(rows, (message) => message.authorId),
          Arr.flatMap(rows, (message) => mentionedPeople(message.mentions))
        )
      ),
      (personId) =>
        reader.table("tenantPeople").get(personId).pipe(Effect.option),
      { concurrency: "unbounded" }
    ).pipe(Effect.map(Arr.getSomes));
    return yield* Effect.forEach(rows, (message) =>
      Effect.gen(function* () {
        // Every author was read above, so a message without its author is a defect.
        const author = yield* Effect.fromOption(
          Arr.findFirst(
            people,
            (candidate) => candidate._id === message.authorId
          )
        );
        const mentions = Arr.flatMap(
          message.mentions ?? [],
          (mention): (typeof MentionView.Type)[] =>
            mention._tag === "everyone"
              ? [mention]
              : Option.match(
                  Arr.findFirst(people, (found) => found._id === mention.id),
                  {
                    onNone: () => [],
                    onSome: (found) => [
                      {
                        _tag: "person" as const,
                        id: found._id,
                        name: found.name,
                      },
                    ],
                  }
                )
        );
        const text =
          message.sealedText === null
            ? null
            : yield* openText(keys, messageField(message), message.sealedText);
        const discussion =
          message.startsThreadId === undefined
            ? null
            : yield* discussionView(
                yield* reader
                  .table("classroomThreads")
                  .get(message.startsThreadId)
              );
        return {
          attachments: yield* attachmentViews(message, keys),
          author: { id: message.authorId, name: author.name },
          clientKey: message.clientKey,
          createdAt: message.createdAt,
          discussion,
          editedAt: message.editedAt ?? null,
          id: message._id,
          mentions,
          mine: message.authorId === person._id,
          poll: yield* pollView(message, keys),
          text,
        };
      }).pipe(Effect.orDie)
    );
  }
);

/** The view of one message for the viewer. */
export const messageView = (row: ClassroomMessagesDoc) =>
  Effect.map(messageViews([row]), (views) => Arr.getUnsafe(views, 0));
