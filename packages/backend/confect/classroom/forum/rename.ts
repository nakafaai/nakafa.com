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
} from "@repo/backend/confect/classroom/forum/channel";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import {
  ChannelFixed,
  ChannelNameTaken,
} from "@repo/backend/confect/classroom/forum/errors";
import { classChannel } from "@repo/backend/confect/classroom/forum/lookup";
import { Array as Arr, Effect } from "effect";

/**
 * Renames a topic channel of a class. The general channel keeps its name, because the page
 * translates it for each reader. A new name is unique among the class's channels, compared
 * without case, and a channel may change its own case. The class's `forum.manage` decision admits
 * an Admin or a subject teacher of the class, and refuses an archived class as a write.
 */
export const rename = FunctionImpl.make(
  databaseSchema,
  spec,
  "rename",
  Effect.fn("classroom.forum.channels.rename")(function* ({ channelId, name }) {
    const row = yield* Class;
    const channel = yield* classChannel(channelId, "forum.manage");
    if (channel.kind === "general") {
      return yield* new ChannelFixed();
    }
    const channels = yield* (yield* DatabaseReader)
      .table("classroomChannels")
      .index("by_classId_and_position", (query) => query.eq("classId", row._id))
      .take(CHANNEL_LIMIT)
      .pipe(Effect.orDie);
    const key = channelNameKey(name);
    const taken = Arr.some(
      channels,
      (other) => other._id !== channelId && channelNameKey(other.name) === key
    );
    if (taken) {
      return yield* new ChannelNameTaken();
    }
    yield* (yield* DatabaseWriter)
      .table("classroomChannels")
      .patch(channelId, { name })
      .pipe(Effect.orDie);
    return null;
  })
);
