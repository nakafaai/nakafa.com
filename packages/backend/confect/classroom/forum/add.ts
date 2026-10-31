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
import { Array as Arr, Clock, Effect } from "effect";

/**
 * Adds a topic channel to a class, after its last channel. The name is unique
 * among the class's channels, compared without case, and a class holds at most
 * CHANNEL_LIMIT channels. A class holds its general channel at 0 from its
 * creation, and a removed channel leaves a gap, so the new channel takes the
 * position after the last one. The class's
 * `forum.manage` decision admits an Admin or a subject teacher of the class, and
 * refuses an archived class as a write.
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
    // The channels are read in position order, so the last one sets the next place.
    const position = Arr.reduce(
      channels,
      0,
      (_next, channel) => channel.position + 1
    );
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
    return channelView(created, { last: null, unread: false });
  })
);
