import { Id } from "@repo/backend/confect/_generated/id";
import {
  ClientKey,
  DiscussionNumber,
  DiscussionView,
  MessageView,
} from "@repo/backend/confect/classroom/forum/message";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The most characters the title of a discussion may have. */
const TITLE_MAX_LENGTH = 120;

/** The title of a discussion as a member writes it: one trimmed line of 1 to 120 characters. */
export const DiscussionTitle = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(TITLE_MAX_LENGTH)
);

/**
 * One numbered discussion of a class (ADR 0025). Its title is sealed with the
 * school key, bound to the class, the channel and the client key of the message
 * that opens it, which shares that key, so the opening message is found by it.
 * The number counts per class: an open reads the highest number of the class in
 * its own transaction, and Convex retries a concurrent open, so two discussions
 * of one class never share a number. `replies` counts the replies, and
 * `lastReplyAt` is the time of the newest one.
 */
export const threadValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  channelId: Id("classroomChannels"),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  lastReplyAt: Schema.optionalKey(Schema.Finite),
  number: DiscussionNumber,
  replies: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  sealedTitle: Sealed,
  tenantId: Id("tenants"),
});

/** One discussion as its own page shows it: its channel, its summary, and its opening message. */
export const ThreadView = Schema.Struct({
  channelId: Id("classroomChannels"),
  discussion: DiscussionView,
  id: Id("classroomThreads"),
  opening: MessageView,
});

/** The sealed field of a discussion's title, bound to the row that names it (ADR 0030). */
export const titleField = (
  row: Pick<typeof threadValidator.Type, "channelId" | "classId" | "clientKey">
) => ({
  field: "sealedTitle",
  row: [row.classId, row.channelId, row.clientKey],
  table: "classroomThreads",
});
