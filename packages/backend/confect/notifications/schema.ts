import type { NotificationsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { ObjectRef } from "@repo/backend/confect/access/catalog";
import {
  ConsumedChangeType,
  SubjectView,
} from "@repo/backend/confect/journal/schema";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * One inbox row: one recipient Person and one invitation. A resend refreshes the
 * row of its invitation rather than adding one, so the row shows the latest entry
 * that sent the invitation. It holds IDs and codes only, and its text is read from
 * its subject when it is opened.
 */
export const Notification = Schema.Struct({
  changeType: ConsumedChangeType,
  createdAt: Schema.Finite,
  inviteId: Id("tenantInvites"),
  journalEntryId: Id("journalEntries"),
  readAt: Schema.optionalKey(Schema.Finite),
  recipientPersonId: Id("tenantPeople"),
  subject: ObjectRef,
  tenantId: Id("tenants"),
});

/** One inbox row as the wire shows it, with the school that holds it. */
export const NotificationView = Schema.Struct({
  changeType: ConsumedChangeType,
  createdAt: Schema.Finite,
  id: Id("notifications"),
  readAt: Schema.optionalKey(Schema.Finite),
  subject: SubjectView,
  tenant: TenantProfile,
});

/**
 * Projects a stored row onto its wire view, with the profile of the school that
 * holds it. The read time is set only once a row is read, so an unread row has
 * no `readAt` key at all.
 */
export const notificationView = (
  row: NotificationsDoc,
  tenant: typeof TenantProfile.Type
) => ({
  changeType: row.changeType,
  createdAt: row.createdAt,
  id: row._id,
  subject: row.subject,
  tenant,
  ...(row.readAt === undefined ? {} : { readAt: row.readAt }),
});
