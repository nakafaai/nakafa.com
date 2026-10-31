import { FunctionImpl } from "@confect/server";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { dropCarried } from "@repo/backend/confect/classroom/forum/attach";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import { ChannelFixed } from "@repo/backend/confect/classroom/forum/errors";
import { classChannel } from "@repo/backend/confect/classroom/forum/lookup";
import { Array as Arr, Duration, Effect, Predicate } from "effect";

/** How many messages and read marks one run of the sweep deletes, so a long chat stays inside a transaction's limits. */
const SWEEP_BATCH = 64;

/**
 * Removes a topic channel of a class for everyone, which cannot be undone. The channel leaves at once, and the sweep
 * deletes what it held. The general channel is the room of every member, so it stays. The class's `forum.manage`
 * decision admits an Admin or a subject teacher of the class, and refuses an archived class as a write.
 */
export const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("classroom.forum.channels.remove")(function* ({ channelId }) {
    const channel = yield* classChannel(channelId, "forum.manage");
    if (channel.kind === "general") {
      return yield* new ChannelFixed();
    }
    yield* (yield* DatabaseWriter)
      .table("classroomChannels")
      .delete(channelId)
      .pipe(Effect.orDie);
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      classroomInternal.forum.channels.sweep,
      { channelId }
    );
    return null;
  })
);

/**
 * Deletes one batch of what a removed channel held: its messages, with their files, their bytes given back to the
 * school and their tallies, the discussions they belong to, and its read marks. A full batch runs the sweep again.
 */
export const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("classroom.forum.channels.sweep")(function* ({ channelId }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const messages = yield* reader
      .table("classroomMessages")
      .index("by_channelId_and_threadId", (query) =>
        query.eq("channelId", channelId)
      )
      .take(SWEEP_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      messages,
      (message) =>
        Effect.gen(function* () {
          yield* dropCarried(message);
          yield* writer
            .table("classroomMessages")
            .delete(message._id)
            .pipe(Effect.orDie);
        }),
      { discard: true }
    );
    yield* Effect.forEach(
      Arr.dedupe(
        Arr.flatMap(messages, (message) =>
          Arr.filter(
            [message.threadId, message.startsThreadId],
            Predicate.isNotUndefined
          )
        )
      ),
      (threadId) =>
        writer.table("classroomThreads").delete(threadId).pipe(Effect.ignore),
      { discard: true }
    );
    const reads = yield* reader
      .table("classroomReads")
      .index("by_channelId", (query) => query.eq("channelId", channelId))
      .take(SWEEP_BATCH)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      reads,
      (read) =>
        writer.table("classroomReads").delete(read._id).pipe(Effect.orDie),
      { discard: true }
    );
    if (messages.length === SWEEP_BATCH || reads.length === SWEEP_BATCH) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        classroomInternal.forum.channels.sweep,
        { channelId }
      );
    }
    return null;
  })
);
