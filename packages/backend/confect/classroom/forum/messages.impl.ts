import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomMessagesDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  classAccess,
  classAuthority,
} from "@repo/backend/confect/classroom/authority";
import { MessageHidden } from "@repo/backend/confect/classroom/forum/errors";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import spec from "@repo/backend/confect/classroom/forum/messages.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/** The keys of the school of a class, which seal and open its messages. A school without keys is a defect. */
const schoolKeys = (tenantId: GenericId.GenericId<"tenants">) =>
  readTenantKeys(tenantId).pipe(Effect.orDie);

/** A channel or a message that is not the allowed class's own, refused as a missing object. */
const missing = (action: "forum.manage" | "forum.post" | "forum.read") =>
  new AccessDenied({ action, reason: "resource" });

/** The channel a read or a send names, when it belongs to the class the check allowed. */
const classChannel = Effect.fn("classroom.forum.messages.channel")(function* (
  channelId: GenericId.GenericId<"classroomChannels">,
  action: "forum.post" | "forum.read"
) {
  const row = yield* Class;
  const channel = yield* (yield* DatabaseReader)
    .table("classroomChannels")
    .get(channelId)
    .pipe(Effect.option);
  if (Option.isNone(channel) || channel.value.classId !== row._id) {
    return yield* missing(action);
  }
  return channel.value;
});

/** The message an edit or a hide names, when it belongs to the class the check allowed. */
const classMessage = Effect.fn("classroom.forum.messages.message")(function* (
  messageId: GenericId.GenericId<"classroomMessages">,
  action: "forum.manage" | "forum.post"
) {
  const row = yield* Class;
  const message = yield* (yield* DatabaseReader)
    .table("classroomMessages")
    .get(messageId)
    .pipe(Effect.option);
  if (Option.isNone(message) || message.value.classId !== row._id) {
    return yield* missing(action);
  }
  return message.value;
});

/**
 * The views of some messages for the viewer: each text opened with the school
 * key, each author's name read once, and a hidden message without its text.
 */
const messageViews = Effect.fn("classroom.forum.messages.views")(function* (
  rows: readonly ClassroomMessagesDoc[]
) {
  const { person } = yield* Member;
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const keys = yield* schoolKeys(row.tenantId);
  const authors = yield* Effect.forEach(
    Arr.dedupe(Arr.map(rows, (message) => message.authorId)),
    (authorId) => reader.table("tenantPeople").get(authorId).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  return yield* Effect.forEach(rows, (message) =>
    Effect.gen(function* () {
      // Every author was read above, so a message without its author is a defect.
      const author = yield* Effect.fromOption(
        Arr.findFirst(
          authors,
          (candidate) => candidate._id === message.authorId
        )
      ).pipe(Effect.orDie);
      const text =
        message.sealedText === null
          ? null
          : yield* openText(
              keys,
              messageField(message),
              message.sealedText
            ).pipe(Effect.orDie);
      return {
        author: { id: message.authorId, name: author.name },
        createdAt: message.createdAt,
        editedAt: message.editedAt ?? null,
        id: message._id,
        mine: message.authorId === person._id,
        text,
      };
    })
  );
});

/** The view of one message for the viewer. */
const messageView = (row: ClassroomMessagesDoc) =>
  Effect.map(messageViews([row]), (views) => Arr.getUnsafe(views, 0));

/**
 * One page of a channel's messages, newest first, so the forum loads older ones
 * as the reader scrolls up. The read is indexed by channel and bounded by the
 * page size.
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
        "by_channelId",
        (query) => query.eq("channelId", channelId),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, { page: yield* messageViews(found.page) });
  })
);

/**
 * Sends a message to a channel, sealed with the school key. A send that repeats
 * the client key of the sender's message in this channel answers that message and
 * writes nothing, so a retry after a lost answer never posts twice.
 */
const send = FunctionImpl.make(
  databaseSchema,
  spec,
  "send",
  Effect.fn("classroom.forum.messages.send")(function* ({
    channelId,
    clientKey,
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
    const fields = { channelId: channel._id, classId: row._id, clientKey };
    const sealedText = yield* sealText(
      yield* schoolKeys(row.tenantId),
      messageField(fields),
      text
    ).pipe(Effect.orDie);
    const messageId = yield* (yield* DatabaseWriter)
      .table("classroomMessages")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt: yield* Clock.currentTimeMillis,
        sealedText,
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
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
