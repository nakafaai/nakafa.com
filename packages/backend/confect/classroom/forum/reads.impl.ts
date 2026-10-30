import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import {
  classChannel,
  classThread,
} from "@repo/backend/confect/classroom/forum/lookup";
import { moveMark, readMark } from "@repo/backend/confect/classroom/forum/mark";
import type { ReadPlace } from "@repo/backend/confect/classroom/forum/read";
import spec from "@repo/backend/confect/classroom/forum/reads.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Clock, Effect, Layer, Match, Option } from "effect";

/** The channel and the discussion a read place names, when they belong to the class the check allowed. */
const placeOf = Effect.fn("classroom.forum.reads.place")(function* (
  place: typeof ReadPlace.Type
) {
  return yield* Match.valueTags(place, {
    channel: ({ channelId }) =>
      Effect.map(classChannel(channelId, "forum.read"), (channel) => ({
        channelId: channel._id,
        threadId: undefined,
      })),
    discussion: ({ number }) =>
      Effect.map(classThread(number, "forum.read"), (thread) => ({
        channelId: thread.channelId,
        threadId: thread._id,
      })),
  });
});

/** How far the viewer has read one place of the class's forum. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("classroom.forum.reads.get")(function* ({ place }) {
    const { person } = yield* Member;
    const mark = yield* readMark(person._id, yield* placeOf(place));
    return {
      at: Option.match(mark, {
        onNone: () => null,
        onSome: (found) => found.at,
      }),
    };
  })
);

/**
 * Moves the viewer's read mark in one place forward to `at`, the time of the
 * newest message the viewer has seen there. A time in the future reads as now, so
 * a wrong clock never marks messages that do not exist yet, and a mark never moves
 * back.
 */
const mark = FunctionImpl.make(
  databaseSchema,
  spec,
  "mark",
  Effect.fn("classroom.forum.reads.mark")(function* ({ at, place }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const now = yield* Clock.currentTimeMillis;
    return {
      at: yield* moveMark(
        person._id,
        row,
        yield* placeOf(place),
        Math.min(at, now)
      ),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(mark),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
