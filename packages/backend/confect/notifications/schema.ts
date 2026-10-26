import type { NotificationsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { ObjectRef } from "@repo/backend/confect/access/catalog";
import { SubjectView } from "@repo/backend/confect/journal/schema";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/** What every inbox row holds: its recipient Person, its school, its subject, and when it came and was read. */
const rowFields = {
  createdAt: Schema.Finite,
  readAt: Schema.optionalKey(Schema.Finite),
  recipientPersonId: Id("tenantPeople"),
  subject: ObjectRef,
  tenantId: Id("tenants"),
};

/**
 * The row of one invitation for its Person. A resend refreshes the row of its
 * invitation rather than adding one, so the row shows the latest entry that sent
 * the invitation.
 */
const InvitationRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("person.invited"),
  inviteId: Id("tenantInvites"),
  journalEntryId: Id("journalEntries"),
});

/**
 * The row of one mention of a Person in a class forum, written in the
 * transaction of the message that mentions it (ADR 0025). Its subject is the
 * class.
 */
const MentionRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("forum.mentioned"),
  messageId: Id("classroomMessages"),
});

/** The row of one class announcement for one member of the class. Its subject is the class. */
const AnnouncementRow = Schema.Struct({
  ...rowFields,
  changeType: Schema.Literal("announcement.posted"),
  postId: Id("classroomPosts"),
});

/**
 * One inbox row: one recipient Person and one invitation, mention, or
 * announcement, told apart by `changeType`. It holds IDs and codes only, and its
 * text is read from its subject when it is opened (ADR 0027).
 */
export const Notification = Schema.Union([
  InvitationRow,
  MentionRow,
  AnnouncementRow,
]);

/** What a row tells: an invitation, a mention, or an announcement. */
export const NotificationType = Schema.Literals([
  "person.invited",
  "forum.mentioned",
  "announcement.posted",
]);

/**
 * The place a class row opens, read from its source when the row is read, while
 * the recipient still reads the class: who did it, the class, and where in the
 * class. A mention opens its message in its channel, or in its discussion; an
 * announcement opens the class home.
 */
export const ClassDetail = Schema.Struct({
  actor: Schema.String,
  channelId: Schema.NullOr(Id("classroomChannels")),
  className: Schema.String,
  classSlug: Schema.String,
  discussion: Schema.NullOr(Schema.Int),
  messageId: Schema.NullOr(Id("classroomMessages")),
});

/**
 * One inbox row as the wire shows it, with the school that holds it. A class row
 * carries its detail while the recipient still reads its class and its source
 * still stands, and no detail otherwise.
 */
export const NotificationView = Schema.Struct({
  changeType: NotificationType,
  createdAt: Schema.Finite,
  detail: Schema.NullOr(ClassDetail),
  id: Id("notifications"),
  readAt: Schema.optionalKey(Schema.Finite),
  subject: SubjectView,
  tenant: TenantProfile,
});

/**
 * Projects a stored row onto its wire view, with the profile of the school that
 * holds it and the detail its source gives. The read time is set only once a row
 * is read, so an unread row has no `readAt` key at all.
 */
export const notificationView = (
  row: NotificationsDoc,
  tenant: typeof TenantProfile.Type,
  detail: typeof ClassDetail.Type | null
) => ({
  changeType: row.changeType,
  createdAt: row.createdAt,
  detail,
  id: row._id,
  subject: row.subject,
  tenant,
  ...(row.readAt === undefined ? {} : { readAt: row.readAt }),
});
