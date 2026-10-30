import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { Effect, Option } from "effect";

/** The forum actions a lookup refuses under. */
type ForumAction = "forum.manage" | "forum.post" | "forum.read";

/** A channel, a message or a discussion that is not the allowed class's own, refused as a missing object. */
export const missing = (action: ForumAction) =>
  new AccessDenied({ action, reason: "resource" });

/** The channel a call names, when it belongs to the class the check allowed. */
export const classChannel = Effect.fn("classroom.forum.lookup.channel")(
  function* (
    channelId: GenericId.GenericId<"classroomChannels">,
    action: ForumAction
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
  }
);

/** The message a call names, when it belongs to the class the check allowed. */
export const classMessage = Effect.fn("classroom.forum.lookup.message")(
  function* (
    messageId: GenericId.GenericId<"classroomMessages">,
    action: ForumAction
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
  }
);

/** The discussion of the allowed class that holds `number`, refused as a missing object when it has none. */
export const classThread = Effect.fn("classroom.forum.lookup.thread")(
  function* (number: number, action: ForumAction) {
    const row = yield* Class;
    const thread = yield* (yield* DatabaseReader)
      .table("classroomThreads")
      .index("by_classId_and_number", (query) =>
        query.eq("classId", row._id).eq("number", number)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(thread)) {
      return yield* missing(action);
    }
    return thread.value;
  }
);
