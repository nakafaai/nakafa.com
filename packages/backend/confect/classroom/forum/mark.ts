import type { GenericId } from "@confect/core";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Effect, Option, Schema, Struct } from "effect";

/** One place of a class's forum: a channel, or one discussion of it. */
export const Place = Schema.Struct({
  channelId: Id("classroomChannels"),
  threadId: Schema.UndefinedOr(Id("classroomThreads")),
});

/** The read mark of one member in one place, if the member has read there. */
export const readMark = Effect.fn("classroom.forum.mark.read")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  place: typeof Place.Type
) {
  return yield* (yield* DatabaseReader)
    .table("classroomReads")
    .index("by_personId_and_channelId_and_threadId", (query) =>
      query
        .eq("personId", personId)
        .eq("channelId", place.channelId)
        .eq("threadId", place.threadId)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * Moves the read mark of one member in one place of a class forward to `at`, and
 * answers where the mark stands. A mark that is already at or past `at` stays and
 * nothing is written, so a repeated mark costs no write and wakes no query.
 */
export const moveMark = Effect.fn("classroom.forum.mark.move")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  row: ClassesDoc,
  place: typeof Place.Type,
  at: number
) {
  const writer = (yield* DatabaseWriter).table("classroomReads");
  const mark = yield* readMark(personId, place);
  if (Option.isNone(mark)) {
    yield* writer
      .insert({
        at,
        channelId: place.channelId,
        classId: row._id,
        personId,
        tenantId: row.tenantId,
        ...(place.threadId === undefined ? {} : { threadId: place.threadId }),
      })
      .pipe(Effect.orDie);
    return at;
  }
  if (mark.value.at >= at) {
    return mark.value.at;
  }
  yield* writer
    .replace(
      mark.value._id,
      Struct.assign(Struct.omit(mark.value, ["_creationTime", "_id"]), { at })
    )
    .pipe(Effect.orDie);
  return at;
});
