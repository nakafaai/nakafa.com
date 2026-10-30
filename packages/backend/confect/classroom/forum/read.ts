import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * How far one member has read one place of a class's forum: a channel, or one
 * discussion of it when `threadId` names one. `at` is the time of the newest
 * message the member has seen there, and it only moves forward. The read state
 * belongs to the classroom module (ADR 0025). `tenantId` is copied from the class
 * for the tenant check of every read.
 */
export const readValidator = Schema.Struct({
  at: Schema.Finite,
  channelId: Id("classroomChannels"),
  classId: Id("classes"),
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
  threadId: Schema.optionalKey(Id("classroomThreads")),
});

/** How far the viewer has read one place: the time of the newest message seen there, or null before the first read. */
export const ReadView = Schema.Struct({ at: Schema.NullOr(Schema.Finite) });

/** One place a member reads: a channel of the class, or one discussion by its number. */
export const ReadPlace = Schema.Union([
  Schema.TaggedStruct("channel", { channelId: Id("classroomChannels") }),
  Schema.TaggedStruct("discussion", {
    number: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  }),
]);
