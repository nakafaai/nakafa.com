import type { NotificationsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { ObjectRef } from "@repo/backend/confect/access/catalog";
import {
  ConsumedChangeType,
  SubjectView,
} from "@repo/backend/confect/journal/schema";
import {
  TenantProfile,
  tenantProfile,
  type tenantValidator,
} from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * One inbox row: one recipient Person and one journal entry, written once. It
 * holds IDs and codes only, and its text is read from its subject when it is
 * opened.
 */
export const Notification = Schema.Struct({
  changeType: ConsumedChangeType,
  createdAt: Schema.Finite,
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
 * Projects a stored row onto its wire view. The read time is set only once a
 * row is read, so an unread row has no `readAt` key at all.
 */
export const notificationView = (
  row: NotificationsDoc,
  tenant: typeof tenantValidator.Type
) => ({
  changeType: row.changeType,
  createdAt: row.createdAt,
  id: row._id,
  subject: row.subject,
  tenant: tenantProfile(tenant),
  ...(row.readAt === undefined ? {} : { readAt: row.readAt }),
});
