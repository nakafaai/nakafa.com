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
 * creation and no channel is removed, so the positions run from 0 without a gap
 * and the new channel takes the count of the channels before it. The class's
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
    const position = channels.length;
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
    return channelView(created, false);
  })
);
