import { FunctionImpl } from "@confect/server";
import type { ClassroomMessagesDoc } from "@repo/backend/confect/_generated/docs";
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
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import { opensDiscussions } from "@repo/backend/confect/classroom/forum/policy";
import {
  TITLE_MAX_LENGTH,
  titleField,
} from "@repo/backend/confect/classroom/forum/thread";
import spec from "@repo/backend/confect/classroom/forum/threads.spec";
import {
  messageView,
  schoolKeys,
} from "@repo/backend/confect/classroom/forum/views";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, String as Str, Struct } from "effect";

/**
 * The title a thread takes from the message it starts from, as Discord names one:
 * the first line of its text, else its poll's question, else its first file's
 * name, cut to what a title holds. A message without text carries a poll or a file.
 */
const titleOfMessage = Effect.fn("classroom.forum.threads.titleOf")(function* (
  message: ClassroomMessagesDoc,
  sealedText: ArrayBuffer
) {
  const line = Arr.headNonEmpty(
    Str.split(
      yield* openText(
        yield* schoolKeys(message.tenantId),
        messageField(message),
        sealedText
      ),
      "\n"
    )
  );
  const view = yield* messageView(message);
  const title =
    line === ""
      ? (view.poll?.question ?? Arr.getUnsafe(view.attachments, 0).name)
      : line;
  return Str.trim(Str.slice(0, TITLE_MAX_LENGTH)(title));
}, Effect.orDie);

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
          yield* titleOfMessage(message, message.sealedText)
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
