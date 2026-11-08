import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  DiscussionsClosed,
  MessageHidden,
} from "@repo/backend/confect/classroom/forum/errors";
import {
  channelOpen,
  classMessage,
  missing,
  nextThreadNumber,
} from "@repo/backend/confect/classroom/forum/lookup";
import { opensDiscussions } from "@repo/backend/confect/classroom/forum/policy";
import {
  threadTitle,
  titleField,
} from "@repo/backend/confect/classroom/forum/thread";
import spec from "@repo/backend/confect/classroom/forum/threads.spec";
import {
  messageView,
  schoolKeys,
} from "@repo/backend/confect/classroom/forum/views";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { sealText } from "@repo/backend/confect/vault/text";
import { Clock, Effect, Struct } from "effect";

/**
 * Starts a thread from a message of a channel, as Slack and Discord let any message
 * take one, under the next number of the class. Starting one that stands answers
 * its number and writes nothing. A student starts one only while the school lets
 * students open discussions, and a reply or a hidden message starts none.
 */
export const start = FunctionImpl.make(
  databaseSchema,
  spec,
  "start",
  Effect.fn("classroom.forum.threads.start")(function* ({ messageId }) {
    const principal = yield* Member;
    const row = yield* Class;
    const message = yield* classMessage(messageId, "forum.post");
    yield* channelOpen(message.channelId);
    if (message.threadId !== undefined) {
      return yield* missing("forum.post");
    }
    if (message.sealedText === null) {
      return yield* new MessageHidden();
    }
    const reader = yield* DatabaseReader;
    if (message.startsThreadId !== undefined) {
      const { number } = yield* reader
        .table("classroomThreads")
        .get(message.startsThreadId)
        .pipe(Effect.orDie);
      return { number };
    }
    if (!(yield* opensDiscussions(row, principal))) {
      return yield* new DiscussionsClosed();
    }
    const number = yield* nextThreadNumber();
    const writer = yield* DatabaseWriter;
    const fields = Struct.pick(message, ["channelId", "classId", "clientKey"]);
    const createdAt = yield* Clock.currentTimeMillis;
    const threadId = yield* writer
      .table("classroomThreads")
      .insert({
        ...fields,
        authorId: principal.person._id,
        createdAt,
        number,
        replies: 0,
        sealedTitle: yield* sealText(
          yield* schoolKeys(row.tenantId),
          titleField(fields),
          threadTitle(yield* messageView(message))
        ).pipe(Effect.orDie),
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("classroomMessages")
      .replace(
        message._id,
        Struct.assign(Struct.omit(message, ["_creationTime", "_id"]), {
          startsThreadId: threadId,
        })
      )
      .pipe(Effect.orDie);
    return { number };
  })
);
