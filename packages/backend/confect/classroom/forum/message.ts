import { Id } from "@repo/backend/confect/_generated/id";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** The most characters one message of the forum may hold. */
const MESSAGE_MAX_LENGTH = 4000;

/** The text of a message as a member writes it: trimmed, and 1 to 4,000 characters. */
export const MessageText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(MESSAGE_MAX_LENGTH)
);

/**
 * The key the composer gives one message before it is sent. A send that repeats
 * the key of a message already stored in its channel writes nothing, so a retry
 * after a lost answer never posts twice.
 */
export const ClientKey = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9-]{8,64}$/u)
);

/**
 * One message of a channel. Its text is sealed with the school key (ADR 0030),
 * bound to the class, the channel and the client key, so a sealed text copied to
 * another row never opens. A hidden message keeps its place in the channel but
 * no text: a teacher's hide removes it for good. `tenantId` is copied from the
 * class for the tenant check of every read.
 */
export const messageValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  channelId: Id("classroomChannels"),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  editedAt: Schema.optionalKey(Schema.Finite),
  hiddenAt: Schema.optionalKey(Schema.Finite),
  sealedText: Schema.NullOr(Sealed),
  tenantId: Id("tenants"),
});

/**
 * One message as the forum shows it: its author's name, its text, or null once a
 * teacher hid it, when it was written and last edited, and whether the viewer
 * wrote it. Its client key is the one the composer gave it, so the forum keeps
 * one row for the message from the moment it is sent to the server's answer.
 */
export const MessageView = Schema.Struct({
  author: Schema.Struct({
    id: Id("tenantPeople"),
    name: Schema.String,
  }),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  editedAt: Schema.NullOr(Schema.Finite),
  id: Id("classroomMessages"),
  mine: Schema.Boolean,
  text: Schema.NullOr(Schema.String),
});

/** The sealed field of a message's text, bound to the row that names it (ADR 0030). */
export const messageField = (
  row: Pick<typeof messageValidator.Type, "channelId" | "classId" | "clientKey">
) => ({
  field: "sealedText",
  row: [row.classId, row.channelId, row.clientKey],
  table: "classroomMessages",
});
