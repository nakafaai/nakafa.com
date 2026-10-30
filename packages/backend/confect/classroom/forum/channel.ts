import type { ClassroomChannelsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/**
 * Channels one class holds, the general channel included. Every read of the
 * channel list takes at most this many rows, and a channel past it is refused, so
 * no read truncates the list.
 */
export const CHANNEL_LIMIT = 48;

/** The most characters a topic channel's name may have. */
export const CHANNEL_NAME_MAX_LENGTH = 40;

/**
 * The stored name of every general channel. The class page shows the translated
 * label of a general channel, so this name only identifies it in the store.
 */
export const GENERAL_CHANNEL_NAME = "general";

/** A general channel is the room of every member of a class; a topic channel is one a teacher adds. */
const ChannelKind = Schema.Literals(["general", "topic"]);

/** A channel's name, one line, 1 to 40 characters, as a list shows it. */
export const ChannelName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(CHANNEL_NAME_MAX_LENGTH)
);

/** The name in the form that uniqueness compares: the lowercase name. */
export const channelNameKey = (name: string) => name.toLowerCase();

/**
 * A channel of one class. `position` orders the list from 0, the general channel,
 * and a topic channel takes the position after the last one. `tenantId` is copied
 * from the class for indexing and for the tenant check of every read.
 */
export const channelValidator = Schema.Struct({
  classId: Id("classes"),
  createdAt: Schema.Finite,
  kind: ChannelKind,
  name: ChannelName,
  position: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  tenantId: Id("tenants"),
});

/**
 * One channel as the wire shows it, and whether a message came to it after the
 * viewer last read it.
 */
export const ChannelView = Schema.Struct({
  id: Id("classroomChannels"),
  kind: ChannelKind,
  name: ChannelName,
  unread: Schema.Boolean,
});

/** One channel of a class as the wire shows it, unread or not for the viewer. */
export const channelView = (row: ClassroomChannelsDoc, unread: boolean) => ({
  id: row._id,
  kind: row.kind,
  name: row.name,
  unread,
});
