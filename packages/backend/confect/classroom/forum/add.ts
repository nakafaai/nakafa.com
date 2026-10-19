import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  CHANNEL_LIMIT,
  channelNameKey,
  channelView,
} from "@repo/backend/confect/classroom/forum/channel";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import {
  ChannelLimit,
  ChannelNameTaken,
} from "@repo/backend/confect/classroom/forum/errors";
import { Array as Arr, Clock, Effect, Option } from "effect";

/**
 * The position of a topic in a class that holds no channel. Every class created
 * since channels exist holds its general channel at 0, so this case only reaches a
 * class from before the backfill, and position 1 keeps the backfilled general
 * channel ahead of the topic.
 */
const FIRST_TOPIC_POSITION = 1;

/**
 * Adds a topic channel to a class, after its last channel. The name is unique
 * among the class's channels, compared without case, and a class holds at most
 * CHANNEL_LIMIT channels. The class's `forum.manage` decision admits an Admin or a
 * subject teacher of the class, and refuses an archived class as a write.
 */
export const add = FunctionImpl.make(
  databaseSchema,
  spec,
  "add",
  Effect.fn("classroom.forum.channels.add")(function* ({ name }) {
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const channels = yield* reader
      .table("classroomChannels")
      .index("by_classId_and_position", (query) => query.eq("classId", row._id))
      .take(CHANNEL_LIMIT)
      .pipe(Effect.orDie);
    if (channels.length >= CHANNEL_LIMIT) {
      return yield* new ChannelLimit();
    }
    const key = channelNameKey(name);
    if (Arr.some(channels, (channel) => channelNameKey(channel.name) === key)) {
      return yield* new ChannelNameTaken();
    }
    const position = Option.match(Arr.last(channels), {
      onNone: () => FIRST_TOPIC_POSITION,
      onSome: (last) => last.position + 1,
    });
    const now = yield* Clock.currentTimeMillis;
    const channelId = yield* (yield* DatabaseWriter)
      .table("classroomChannels")
      .insert({
        classId: row._id,
        createdAt: now,
        kind: "topic",
        name,
        position,
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    const created = yield* reader
      .table("classroomChannels")
      .get(channelId)
      .pipe(Effect.orDie);
    return channelView(created);
  })
);
