import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import { ChannelFixed } from "@repo/backend/confect/classroom/forum/errors";
import { classChannel } from "@repo/backend/confect/classroom/forum/lookup";
import { Clock, Effect } from "effect";

/**
 * Archives a topic channel of a class, or brings one back. An archived channel stays readable and takes nothing
 * new. The general channel is the room of every member, so it stays. The class's `forum.manage` decision admits an
 * Admin or a subject teacher of the class, and refuses an archived class as a write.
 */
export const archive = FunctionImpl.make(
  databaseSchema,
  spec,
  "archive",
  Effect.fn("classroom.forum.channels.archive")(function* ({
    archived,
    channelId,
  }) {
    const channel = yield* classChannel(channelId, "forum.manage");
    if (channel.kind === "general") {
      return yield* new ChannelFixed();
    }
    yield* (yield* DatabaseWriter)
      .table("classroomChannels")
      .patch(channelId, {
        archivedAt: archived ? yield* Clock.currentTimeMillis : undefined,
      })
      .pipe(Effect.orDie);
    return null;
  })
);
