import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  classAccess,
  classAuthority,
} from "@repo/backend/confect/classroom/authority";
import { MessageHidden } from "@repo/backend/confect/classroom/forum/errors";
import {
  classChannel,
  classMessage,
  missing,
} from "@repo/backend/confect/classroom/forum/lookup";
import { moveMark } from "@repo/backend/confect/classroom/forum/mark";
import {
  checkMentions,
  noticeMentions,
} from "@repo/backend/confect/classroom/forum/notice";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import spec from "@repo/backend/confect/classroom/forum/messages.spec";
import {
  messageView,
  messageViews,
  schoolKeys,
} from "@repo/backend/confect/classroom/forum/views";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { sealText } from "@repo/backend/confect/vault/text";
import { Clock, Effect, Layer, Option, Struct } from "effect";

/**
 * One page of a channel's messages, newest first, so the forum loads older ones
 * as the reader scrolls up. The replies of its discussions stay in their
 * discussions. The read is indexed by channel and bounded by the page size.
 */
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("classroom.forum.messages.page")(function* ({
    channelId,
    paginationOpts,
  }) {
    yield* classChannel(channelId, "forum.read");
    const found = yield* (yield* DatabaseReader)
      .table("classroomMessages")
      .index(
        "by_channelId_and_threadId",
        (query) => query.eq("channelId", channelId).eq("threadId", undefined),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, { page: yield* messageViews(found.page) });
  })
);

/**
 * Sends a message to a channel, sealed with the school key, writes the inbox row
 * of each Person it mentions, and moves the sender's read mark in the channel to
 * it. A send that repeats the client key of the
 * sender's message in this channel answers that message and writes nothing, so a
 * retry after a lost answer never posts twice.
 */
const send = FunctionImpl.make(
  databaseSchema,
  spec,
  "send",
  Effect.fn("classroom.forum.messages.send")(function* ({
    channelId,
    clientKey,
    mentions,
    text,
  }) {
    const { person } = yield* Member;
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
      if (sent.value.authorId !== person._id) {
        return yield* missing("forum.post");
      }
      return yield* messageView(sent.value);
    }
    const checked = yield* checkMentions(row, mentions);
    const fields = { channelId: channel._id, classId: row._id, clientKey };
    const sealedText = yield* sealText(
      yield* schoolKeys(row.tenantId),
      messageField(fields),
      text
    ).pipe(Effect.orDie);
    const createdAt = yield* Clock.currentTimeMillis;
    const messageId = yield* (yield* DatabaseWriter)
      .table("classroomMessages")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt,
        mentions: checked.stored,
        sealedText,
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    yield* noticeMentions(messageId, row, createdAt, checked);
    yield* moveMark(
      person._id,
      row,
      { channelId: channel._id, threadId: undefined },
      createdAt
    );
    return yield* messageView(
      yield* reader.table("classroomMessages").get(messageId).pipe(Effect.orDie)
    );
  })
);

/** Changes the text of the sender's own message. A message a teacher hid keeps no text to change. */
const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("classroom.forum.messages.edit")(function* ({ messageId, text }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const message = yield* classMessage(messageId, "forum.post");
    if (message.authorId !== person._id) {
      return yield* missing("forum.post");
    }
    if (message.sealedText === null) {
      return yield* new MessageHidden();
    }
    const edited = Struct.assign(message, {
      editedAt: yield* Clock.currentTimeMillis,
      sealedText: yield* sealText(
        yield* schoolKeys(row.tenantId),
        messageField(message),
        text
      ).pipe(Effect.orDie),
    });
    yield* (yield* DatabaseWriter)
      .table("classroomMessages")
      .replace(message._id, Struct.omit(edited, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    return yield* messageView(edited);
  })
);

/**
 * Hides a message for good: its text is removed and its place in the channel
 * stays, and the journal records the hide without the text.
 */
const hide = FunctionImpl.make(
  databaseSchema,
  spec,
  "hide",
  Effect.fn("classroom.forum.messages.hide")(function* ({ messageId }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const message = yield* classMessage(messageId, "forum.manage");
    if (message.sealedText === null) {
      return yield* messageView(message);
    }
    const hidden = Struct.assign(message, {
      hiddenAt: yield* Clock.currentTimeMillis,
      sealedText: null,
    });
    yield* (yield* DatabaseWriter)
      .table("classroomMessages")
      .replace(message._id, Struct.omit(hidden, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), row, {
      message: message._id,
      type: "message.hidden",
    });
    return yield* messageView(hidden);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  Layer.provide(send),
  Layer.provide(edit),
  Layer.provide(hide),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
