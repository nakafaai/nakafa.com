import { FunctionImpl } from "@confect/server";
import type { ClassroomChannelsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { channelView } from "@repo/backend/confect/classroom/forum/channel";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import { readMark } from "@repo/backend/confect/classroom/forum/mark";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option, Struct } from "effect";

/**
 * Whether the newest message of a channel came after the viewer's read mark in
 * it. The viewer's own message moves the viewer's mark, so it never counts. A
 * channel the viewer never read is unread once it holds a message.
 */
const unreadIn = Effect.fn("classroom.forum.channels.unread")(function* (
  channel: ClassroomChannelsDoc
) {
  const { person } = yield* Member;
  const newest = yield* (yield* DatabaseReader)
    .table("classroomMessages")
    .index(
      "by_channelId_and_threadId",
      (query) => query.eq("channelId", channel._id).eq("threadId", undefined),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(newest)) {
    return false;
  }
  const mark = yield* readMark(person._id, {
    channelId: channel._id,
    threadId: undefined,
  });
  return Option.match(mark, {
    onNone: () => true,
    onSome: (found) => newest.value.createdAt > found.at,
  });
});

/**
 * One page of a class's channels in position order, the general channel first,
 * each unread or not for the viewer. The read is indexed by class and bounded by
 * the page size, and each channel reads its newest message and the viewer's mark.
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
        Effect.map(unreadIn(channel), (unread) => channelView(channel, unread))
      ),
    });
  })
);
