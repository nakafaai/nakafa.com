import type { GenericId } from "@confect/core";
import type {
  ClassroomMessagesDoc,
  ClassroomThreadsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { fileAddress } from "@repo/backend/confect/bucket/file";
import { Class } from "@repo/backend/confect/classroom/access";
import { attachmentField } from "@repo/backend/confect/classroom/forum/attachment";
import type { Face } from "@repo/backend/confect/classroom/forum/face";
import { replierPeople } from "@repo/backend/confect/classroom/forum/face";
import {
  faceOf,
  ninaFace,
  readFaces,
  replierFaces,
} from "@repo/backend/confect/classroom/forum/faces";
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
 * A discussion as the viewer sees it: its title opened with the school key, the
 * faces of who wrote its newest replies, found among `faces`, and unread when a
 * reply came after the viewer's read mark in it. A discussion the viewer never
 * opened is unread once it holds a reply.
 */
const discussionView = Effect.fn("classroom.forum.views.discussion")(function* (
  thread: ClassroomThreadsDoc,
  faces: readonly (typeof Face.Type)[]
) {
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
    repliers: replierFaces(faces, thread.repliers ?? []),
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
});

/** Some discussions as the viewer sees them, the faces of their repliers each read once. */
export const discussionViews = Effect.fn("classroom.forum.views.discussions")(
  function* (threads: readonly ClassroomThreadsDoc[]) {
    const faces = yield* readFaces(
      Arr.flatMap(threads, (thread) => replierPeople(thread.repliers ?? []))
    );
    return yield* Effect.forEach(threads, (thread) =>
      discussionView(thread, faces)
    );
  }
);

/** The keys a school's forum opens with. */
type SchoolKeys = Effect.Success<ReturnType<typeof schoolKeys>>;

/**
 * The files of a message for the viewer: each name opened with the school key,
 * and each R2 address signed for the hour after the access check (ADR 0028). A
 * file the bucket no longer holds shows without an address.
 */
const attachmentViews = Effect.fn("classroom.forum.views.attachments")(
  function* (message: ClassroomMessagesDoc, keys: SchoolKeys) {
    const addressOf = (fileId: GenericId.GenericId<"bucketFiles">) =>
      fileAddress(fileId).pipe(Effect.map(Option.getOrNull));
    return yield* Effect.forEach(message.attachments ?? [], (file) =>
      Effect.gen(function* () {
        const name = yield* openText(
          keys,
          attachmentField({
            classId: message.classId,
            fileId: file.fileId,
          }),
          file.sealedName
        );
        return {
          address: yield* addressOf(file.fileId),
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
    // The discussions the page's messages open, each read once.
    const threads = yield* Effect.forEach(
      Arr.dedupe(
        Arr.flatMap(rows, (message) =>
          message.startsThreadId === undefined ? [] : [message.startsThreadId]
        )
      ),
      (threadId) =>
        reader.table("classroomThreads").get(threadId).pipe(Effect.orDie),
      { concurrency: "unbounded" }
    );
    // The authors, the mentioned Persons and the repliers of the page, each read once. A
    // mentioned Person who is gone is left out of its message's mentions.
    const faces = yield* readFaces(
      Arr.flatten([
        Arr.map(rows, (message) => message.authorId),
        Arr.flatMap(rows, (message) => mentionedPeople(message.mentions)),
        Arr.flatMap(threads, (thread) => replierPeople(thread.repliers ?? [])),
      ])
    );
    return yield* Effect.forEach(rows, (message) =>
      Effect.gen(function* () {
        // Every author was read above, so a message without its author is a defect.
        const author = yield* Effect.fromOption(
          faceOf(faces, message.authorId)
        );
        const mentions = Arr.flatMap(
          message.mentions ?? [],
          (mention): (typeof MentionView.Type)[] =>
            mention._tag === "person"
              ? Option.match(faceOf(faces, mention.id), {
                  onNone: () => [],
                  onSome: (found) => [
                    { _tag: "person" as const, id: found.id, name: found.name },
                  ],
                })
              : [mention]
        );
        const text =
          message.sealedText === null
            ? null
            : yield* openText(keys, messageField(message), message.sealedText);
        const thread = Arr.findFirst(
          threads,
          (found) => found._id === message.startsThreadId
        );
        const discussion = Option.isSome(thread)
          ? yield* discussionView(thread.value, faces)
          : null;
        return {
          attachments: yield* attachmentViews(message, keys),
          author: message.nina === true ? ninaFace(author) : author,
          clientKey: message.clientKey,
          createdAt: message.createdAt,
          discussion,
          editedAt: message.editedAt ?? null,
          id: message._id,
          mentions,
          mine: message.nina !== true && message.authorId === person._id,
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
