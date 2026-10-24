import { describe, expect, it } from "@effect/vitest";
import { NotificationView } from "@repo/backend/confect/notifications/schema";
import { Option, Schema } from "effect";
import { pageOf } from "@/components/notifications/destination";
import type { ListNotification } from "@/components/notifications/state";

/** An inbox row as the server sends it, about the subject that it names. */
function row(subject: unknown): ListNotification {
  return Schema.decodeUnknownSync(NotificationView)({
    changeType: "person.invited",
    createdAt: 1,
    id: "notification-1",
    subject,
    tenant: {
      kind: "school",
      mascot: "cat.0.243e66.right.open",
      name: "Harapan",
      slug: "harapan",
      status: "active",
    },
  });
}

describe("inbox row destinations", () => {
  it("opens the school's home for an invitation, whose subject is the Person it invites", () => {
    const page = pageOf(row({ id: "person-1", kind: "person" }));

    expect(Option.map(page, (url) => url.href)).toEqual(
      Option.some("https://harapan.nakafa.com/")
    );
  });

  it("opens no page for a subject of any other kind", () => {
    expect(pageOf(row({ kind: "reminder" }))).toEqual(Option.none());
  });
});
