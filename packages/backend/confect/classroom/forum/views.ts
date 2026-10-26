import type { GenericId } from "@confect/core";
import type {
  ClassroomMessagesDoc,
  ClassroomThreadsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { readMark } from "@repo/backend/confect/classroom/forum/mark";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
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

/**
 * The views of some messages for the viewer: each text opened with the school
 * key, each author's name read once, a hidden message without its text, and a
 * message that opens a discussion with that discussion.
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
          Arr.flatMap(rows, (message) =>
            Arr.flatMap(message.mentions ?? [], (mention) =>
              mention._tag === "person" ? [mention.id] : []
            )
          )
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
        const mentions = Arr.flatMap(message.mentions ?? [], (mention) =>
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
          author: { id: message.authorId, name: author.name },
          clientKey: message.clientKey,
          createdAt: message.createdAt,
          discussion,
          editedAt: message.editedAt ?? null,
          id: message._id,
          mentions,
          mine: message.authorId === person._id,
          text,
        };
      }).pipe(Effect.orDie)
    );
  }
);

/** The view of one message for the viewer. */
export const messageView = (row: ClassroomMessagesDoc) =>
  Effect.map(messageViews([row]), (views) => Arr.getUnsafe(views, 0));
