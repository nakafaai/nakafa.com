import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomThreadsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { DiscussionsClosed } from "@repo/backend/confect/classroom/forum/errors";
import {
  classChannel,
  classThread,
  missing,
} from "@repo/backend/confect/classroom/forum/lookup";
import { moveMark } from "@repo/backend/confect/classroom/forum/mark";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import { opensDiscussions } from "@repo/backend/confect/classroom/forum/policy";
import { titleField } from "@repo/backend/confect/classroom/forum/thread";
import spec from "@repo/backend/confect/classroom/forum/threads.spec";
import {
  discussionView,
  messageView,
  messageViews,
  schoolKeys,
} from "@repo/backend/confect/classroom/forum/views";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { sealText } from "@repo/backend/confect/vault/text";
import { Clock, Effect, Layer, Option, Struct } from "effect";

/**
 * A discussion as its own page shows it: its channel, its summary, and the
 * message that opened it, found in its channel by the key the two share.
 */
const threadView = Effect.fn("classroom.forum.threads.view")(function* (
  thread: ClassroomThreadsDoc
) {
  const opening = yield* (yield* DatabaseReader)
    .table("classroomMessages")
    .index("by_channelId_and_clientKey", (query) =>
      query.eq("channelId", thread.channelId).eq("clientKey", thread.clientKey)
    )
    .first()
    .pipe(Effect.orDie, Effect.flatMap(Effect.fromOption), Effect.orDie);
  return {
    channelId: thread.channelId,
    discussion: yield* discussionView(thread),
    id: thread._id,
    opening: yield* messageView(opening),
  };
});

/**
 * Opens a discussion in a channel: its title and its first message, both sealed
 * with the school key, under the next number of the class. A subject teacher
 * always opens one, and a member of the class only while the school lets students
 * open discussions. The opener has read the discussion and the channel up to it.
 * A repeat of the opener's client key in the channel answers the discussion it
 * opened and writes nothing.
 */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("classroom.forum.threads.open")(function* ({
    channelId,
    clientKey,
    text,
    title,
  }) {
    const principal = yield* Member;
    const row = yield* Class;
    const channel = yield* classChannel(channelId, "forum.post");
    const reader = yield* DatabaseReader;
    const sent = yield* reader
      .table("classroomMessages")
      .index("by_channelId_and_clientKey", (query) =>
        query.eq("channelId", channel._id).eq("clientKey", clientKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sent)) {
      if (
        sent.value.authorId !== principal.person._id ||
        sent.value.startsThreadId === undefined
      ) {
        return yield* missing("forum.post");
      }
      return yield* threadView(
        yield* reader
          .table("classroomThreads")
          .get(sent.value.startsThreadId)
          .pipe(Effect.orDie)
      );
    }
    if (!(yield* opensDiscussions(row, principal))) {
      return yield* new DiscussionsClosed();
    }
    const last = yield* reader
      .table("classroomThreads")
      .index(
        "by_classId_and_number",
        (query) => query.eq("classId", row._id),
        "desc"
      )
      .first()
      .pipe(Effect.orDie);
    const keys = yield* schoolKeys(row.tenantId);
    const fields = { channelId: channel._id, classId: row._id, clientKey };
    const createdAt = yield* Clock.currentTimeMillis;
    const writer = yield* DatabaseWriter;
    const threadId = yield* writer
      .table("classroomThreads")
      .insert({
        ...fields,
        authorId: principal.person._id,
        createdAt,
        number: Option.match(last, {
          onNone: () => 1,
          onSome: (found) => found.number + 1,
        }),
        replies: 0,
        sealedTitle: yield* sealText(keys, titleField(fields), title).pipe(
          Effect.orDie
        ),
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("classroomMessages")
      .insert({
        ...fields,
        authorId: principal.person._id,
        createdAt,
        sealedText: yield* sealText(keys, messageField(fields), text).pipe(
          Effect.orDie
        ),
        startsThreadId: threadId,
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    yield* moveMark(
      principal.person._id,
      row,
      { channelId: channel._id, threadId: undefined },
      createdAt
    );
    yield* moveMark(
      principal.person._id,
      row,
      { channelId: channel._id, threadId },
      createdAt
    );
    return yield* threadView(
      yield* reader.table("classroomThreads").get(threadId).pipe(Effect.orDie)
    );
  })
);

/** One discussion of the class by its number. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("classroom.forum.threads.get")(function* ({ number }) {
    return yield* threadView(yield* classThread(number, "forum.read"));
  })
);

/**
 * One page of a discussion's replies, newest first, so the discussion loads older
 * ones as the reader scrolls up. The read is indexed by the discussion and
 * bounded by the page size.
 */
const replies = FunctionImpl.make(
  databaseSchema,
  spec,
  "replies",
  Effect.fn("classroom.forum.threads.replies")(function* ({
    number,
    paginationOpts,
  }) {
    const thread = yield* classThread(number, "forum.read");
    const found = yield* (yield* DatabaseReader)
      .table("classroomMessages")
      .index("by_threadId", (query) => query.eq("threadId", thread._id), "desc")
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, { page: yield* messageViews(found.page) });
  })
);

/**
 * Replies in a discussion, sealed with the school key: the discussion counts the
 * reply and its time, and the sender has read the discussion up to it. A repeat
 * of the sender's client key in the channel answers that reply and writes
 * nothing.
 */
const reply = FunctionImpl.make(
  databaseSchema,
  spec,
  "reply",
  Effect.fn("classroom.forum.threads.reply")(function* ({
    clientKey,
    number,
    text,
  }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const thread = yield* classThread(number, "forum.post");
    const reader = yield* DatabaseReader;
    const sent = yield* reader
      .table("classroomMessages")
      .index("by_channelId_and_clientKey", (query) =>
        query.eq("channelId", thread.channelId).eq("clientKey", clientKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sent)) {
      if (
        sent.value.authorId !== person._id ||
        sent.value.threadId !== thread._id
      ) {
        return yield* missing("forum.post");
      }
      return yield* messageView(sent.value);
    }
    const fields = { channelId: thread.channelId, classId: row._id, clientKey };
    const createdAt = yield* Clock.currentTimeMillis;
    const writer = yield* DatabaseWriter;
    const messageId = yield* writer
      .table("classroomMessages")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt,
        sealedText: yield* sealText(
          yield* schoolKeys(row.tenantId),
          messageField(fields),
          text
        ).pipe(Effect.orDie),
        tenantId: row.tenantId,
        threadId: thread._id,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("classroomThreads")
      .replace(
        thread._id,
        Struct.assign(Struct.omit(thread, ["_creationTime", "_id"]), {
          lastReplyAt: createdAt,
          replies: thread.replies + 1,
        })
      )
      .pipe(Effect.orDie);
    yield* moveMark(
      person._id,
      row,
      { channelId: thread.channelId, threadId: thread._id },
      createdAt
    );
    return yield* messageView(
      yield* reader.table("classroomMessages").get(messageId).pipe(Effect.orDie)
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(get),
  Layer.provide(replies),
  Layer.provide(reply),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
