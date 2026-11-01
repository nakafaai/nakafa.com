import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { NotificationView } from "@repo/backend/confect/notifications/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import {
  hasUnread,
  type ListNotification,
  markPageRead,
  markRowRead,
} from "@/components/notifications/state";

const notificationId = Schema.decodeUnknownSync(Id("notifications"));

/** An inbox row as the server sends it, read at `readAt` when the row names one. */
function row(id: string, readAt?: number): ListNotification {
  return Schema.decodeUnknownSync(NotificationView)({
    changeType: "person.invited",
    detail: null,
    exam: null,
    grade: null,
    createdAt: 1,
    id,
    subject: { id: "person-1", kind: "person" },
    tenant: {
      kind: "school",
      mascot: "cat.0.243e66.right.open",
      name: "Harapan",
      slug: "harapan",
      status: "active",
    },
    ...(readAt === undefined ? {} : { readAt }),
  });
}

describe("inbox list state", () => {
  it("finds an unread row, and none in a read or empty inbox", () => {
    expect(hasUnread([row("first", 3), row("second")])).toBe(true);
    expect(hasUnread([row("first", 3)])).toBe(false);
    expect(hasUnread([])).toBe(false);
  });

  it("marks only the row with the given id read at the given moment", () => {
    expect(
      markRowRead([row("first"), row("second")], notificationId("first"), 5)
    ).toEqual([row("first", 5), row("second")]);
  });

  it("keeps the first read time of a row that is read already", () => {
    const page = [row("first", 3)];

    expect(markRowRead(page, notificationId("first"), 9)).toEqual(page);
  });

  it("leaves the page as it is when no row has the given id", () => {
    const page = [row("first")];

    expect(markRowRead(page, notificationId("missing"), 9)).toEqual(page);
  });

  it("marks every unread row read and keeps the read time of the rows read already", () => {
    expect(
      markPageRead([row("first"), row("second", 3)], 9, undefined)
    ).toEqual([row("first", 9), row("second", 3)]);
  });

  it("marks only the rows of the school a slug names", () => {
    const page = [row("first")];
    expect(
      markPageRead(page, 9, Schema.decodeSync(TenantSlug)("harapan"))
    ).toEqual([row("first", 9)]);
    expect(
      markPageRead(page, 9, Schema.decodeSync(TenantSlug)("lain"))
    ).toEqual(page);
  });

  it("leaves a row of the account itself out of a school's read, and marks it in the Nakafa inbox", () => {
    const reply = Schema.decodeUnknownSync(NotificationView)({
      actor: null,
      changeType: "comment.replied",
      commentId: "comment-1",
      createdAt: 1,
      id: "reply",
    });
    expect(
      markPageRead([reply], 9, Schema.decodeSync(TenantSlug)("harapan"))
    ).toEqual([reply]);
    expect(markPageRead([reply], 9, undefined)).toEqual([
      { ...reply, readAt: 9 },
    ]);
  });
});
