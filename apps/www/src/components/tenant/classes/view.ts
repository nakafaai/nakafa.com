import { Id } from "@repo/backend/confect/_generated/id";
import { DiscussionNumber } from "@repo/backend/confect/classroom/forum/message";
import { Schema } from "effect";

/**
 * What one class page shows: the class's home, its forum's channel list, one channel, or one
 * numbered discussion. A channel and a discussion may name a message to bring into view.
 */
export const ClassView = Schema.Union([
  Schema.TaggedStruct("home", {}),
  Schema.TaggedStruct("forum", {}),
  Schema.TaggedStruct("channel", {
    channelId: Id("classroomChannels"),
    jump: Schema.Option(Id("classroomMessages")),
  }),
  Schema.TaggedStruct("discussion", {
    jump: Schema.Option(Id("classroomMessages")),
    number: DiscussionNumber,
  }),
]);
