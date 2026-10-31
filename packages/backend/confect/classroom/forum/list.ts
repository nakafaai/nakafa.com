import { FunctionImpl } from "@confect/server";
import type {
  ClassroomChannelsDoc,
  ClassroomMessagesDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { channelView } from "@repo/backend/confect/classroom/forum/channel";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import { readMark } from "@repo/backend/confect/classroom/forum/mark";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Option, String as Str, Struct } from "effect";

/** The most characters of a message that a chat list carries, more than one line of the list shows. */
const PREVIEW_MAX_LENGTH = 120;

/** What a message carries, which a list says when it holds no text. */
const mediaOf = (message: ClassroomMessagesDoc) => {
  if (message.poll !== undefined) {
    return "poll" as const;
  }
  return Option.getOrNull(
    Option.map(Arr.head(message.attachments ?? []), (file) => file.kind)
  );
};

/**
 * What the viewer's list says of a channel's newest message: who wrote it and
 * how it starts, and whether it came after the viewer's read mark in the channel.
 * The viewer's own message moves the viewer's mark, so it never counts. A channel
 * the viewer never read is unread once it holds a message.
 */
const latestIn = Effect.fn("classroom.forum.channels.latest")(function* (
  channel: ClassroomChannelsDoc
) {
  const { person } = yield* Member;
  const reader = yield* DatabaseReader;
  const newest = yield* reader
    .table("classroomMessages")
    .index(
      "by_channelId_and_threadId",
      (query) => query.eq("channelId", channel._id).eq("threadId", undefined),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(newest)) {
    return { last: null, unread: false };
  }
  const message = newest.value;
  const mark = yield* readMark(person._id, {
    channelId: channel._id,
    threadId: undefined,
  });
  const author = yield* reader
    .table("tenantPeople")
    .get(message.authorId)
    .pipe(Effect.orDie);
  const text =
    message.sealedText === null
      ? null
      : yield* openText(
          yield* schoolKeys(channel.tenantId),
          messageField(message),
          message.sealedText
        ).pipe(Effect.orDie);
  return {
    last: {
      at: message.createdAt,
      author: author.name,
      media: mediaOf(message),
      mine: message.authorId === person._id,
      text: text === null ? null : Str.slice(0, PREVIEW_MAX_LENGTH)(text),
    },
    unread: Option.match(mark, {
      onNone: () => true,
      onSome: (found) => message.createdAt > found.at,
    }),
  };
});

/**
 * One page of a class's channels in position order, the general channel first,
 * each with its newest message for the viewer. The read is indexed by class and
 * bounded by the page size, and each channel reads its newest message, its author
 * and the viewer's mark, which a list needs anyway to mark the channel unread.
 * The class's own `forum.read` decision admits it, so an archived class keeps its
 * list.
 */
export const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.forum.channels.list")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const page = yield* (yield* DatabaseReader)
      .table("classroomChannels")
      .index("by_classId_and_position", (query) => query.eq("classId", row._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, {
      page: yield* Effect.forEach(page.page, (channel) =>
        Effect.map(latestIn(channel), (latest) => channelView(channel, latest))
      ),
    });
  })
);
