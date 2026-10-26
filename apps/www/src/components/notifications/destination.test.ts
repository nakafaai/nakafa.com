import { describe, expect, it } from "@effect/vitest";
import { NotificationView } from "@repo/backend/confect/notifications/schema";
import { Option, Schema } from "effect";
import { pageOf } from "@/components/notifications/destination";
import type { ListNotification } from "@/components/notifications/state";

/** An inbox row as the server sends it, of the given type, about the subject that it names, with its detail. */
function row(
  changeType: string,
  subject: unknown,
  detail: unknown = null
): ListNotification {
  return Schema.decodeUnknownSync(NotificationView)({
    changeType,
    createdAt: 1,
    detail,
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

/** The detail of a class row, in the class `fisika-x-1`. */
const detail = (
  messageId: string | null,
  channelId: string | null,
  discussion: number | null
) => ({
  actor: "Bu Rina",
  channelId,
  className: "Fisika X-1",
  classSlug: "fisika-x-1",
  discussion,
  messageId,
});

const href = (notification: ListNotification) =>
  Option.map(pageOf(notification), (url) => url.href);

describe("inbox row destinations", () => {
  it("opens the school's home for an invitation, whose subject is the Person it invites", () => {
    expect(
      href(row("person.invited", { id: "person-1", kind: "person" }))
    ).toEqual(Option.some("https://harapan.nakafa.com/"));
  });

  it("opens a mention's message in its channel or in its discussion, and an announcement's class home", () => {
    const klass = { id: "class-1", kind: "class" };
    expect(
      href(
        row("forum.mentioned", klass, detail("message-1", "channel-1", null))
      )
    ).toEqual(
      Option.some(
        "https://harapan.nakafa.com/classes/fisika-x-1/forum?channel=channel-1&message=message-1"
      )
    );
    expect(
      href(row("forum.mentioned", klass, detail("message-2", "channel-1", 12)))
    ).toEqual(
      Option.some(
        "https://harapan.nakafa.com/classes/fisika-x-1/forum/12?message=message-2"
      )
    );
    expect(
      href(row("announcement.posted", klass, detail(null, null, null)))
    ).toEqual(Option.some("https://harapan.nakafa.com/classes/fisika-x-1"));
  });

  it("opens no page for a class row without its detail, or for a subject of any other kind", () => {
    expect(
      pageOf(row("forum.mentioned", { id: "class-1", kind: "class" }))
    ).toEqual(Option.none());
    expect(pageOf(row("person.invited", { kind: "reminder" }))).toEqual(
      Option.none()
    );
  });
});
