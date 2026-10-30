import { Id } from "@repo/backend/confect/_generated/id";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** The most characters one announcement may hold. */
const POST_MAX_LENGTH = 4000;

/** The text of an announcement as a teacher writes it: trimmed, and 1 to 4,000 characters. */
export const PostText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(POST_MAX_LENGTH)
);

/**
 * One announcement of a class, a class post (ADR 0025). The post owns its text,
 * sealed with the school key and bound to the class and the client key of its
 * send, so a repeated send writes once. `email` is the teacher's choice to send
 * the notice by email too (ADR 0027). `tenantId` is copied from the class for the
 * tenant check of every read.
 */
export const postValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  editedAt: Schema.optionalKey(Schema.Finite),
  email: Schema.Boolean,
  sealedText: Sealed,
  tenantId: Id("tenants"),
});

/**
 * One announcement as the class home shows it: its author, its text, when it was
 * posted and last edited, whether it also goes by email, and whether the viewer
 * wrote it.
 */
export const PostView = Schema.Struct({
  author: Schema.Struct({ id: Id("tenantPeople"), name: Schema.String }),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  editedAt: Schema.NullOr(Schema.Finite),
  email: Schema.Boolean,
  id: Id("classroomPosts"),
  mine: Schema.Boolean,
  text: Schema.String,
});

/** The sealed field of an announcement's text, bound to the row that names it (ADR 0030). */
export const postField = (
  row: Pick<typeof postValidator.Type, "classId" | "clientKey">
) => ({
  field: "sealedText",
  row: [row.classId, row.clientKey],
  table: "classroomPosts",
});
