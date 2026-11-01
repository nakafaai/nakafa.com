import { Option } from "effect";
import type {
  ListNotification,
  SchoolNotification,
} from "@/components/notifications/state";
import { schoolOrigin } from "@/lib/routing/school/host";

/**
 * The page that a row opens, on the school's own host, when its subject has one. An invitation
 * opens the home of the school. A mention opens its message, in its discussion when it is a reply
 * and in its channel otherwise, an announcement opens the class home, a new task opens its page, and
 * a coming sitting opens its entry, each while the server gives the row its detail. A guardian's
 * reminder of a child's sitting, and a child's released grade, open the parent home. Any other row,
 * a student's own released grade among them, has no page, so it only marks itself read.
 */
function pageOf(notification: SchoolNotification): Option.Option<URL> {
  const origin = schoolOrigin(notification.tenant.slug);
  if (notification.subject.kind === "person") {
    return Option.some(origin);
  }
  if (
    notification.changeType === "exam.reminder" ||
    (notification.grade !== null && notification.grade.student !== null)
  ) {
    return Option.some(new URL("/orang-tua", origin));
  }
  if (notification.exam !== null) {
    return Option.some(
      new URL(`/sittings/${notification.exam.sittingId}`, origin)
    );
  }
  return Option.map(Option.fromNullOr(notification.detail), (detail) => {
    const page = new URL(`/classes/${detail.classSlug}`, origin);
    if (detail.task !== null) {
      page.pathname = `${page.pathname}/tasks/${detail.task}`;
      return page;
    }
    if (detail.messageId === null) {
      return page;
    }
    page.pathname =
      detail.discussion === null
        ? `${page.pathname}/forum`
        : `${page.pathname}/forum/${detail.discussion}`;
    if (detail.discussion === null && detail.channelId !== null) {
      page.searchParams.set("channel", detail.channelId);
    }
    page.searchParams.set("message", detail.messageId);
    return page;
  });
}

/**
 * The address a row opens: a reply opens its comment on the page that shows it, in
 * the reader's language, through the address that finds that page, and a school's
 * row opens its page on the school's own host. A reply that is gone opens nothing.
 */
export function addressOf(notification: ListNotification, locale: string) {
  if (notification.changeType === "comment.replied") {
    return notification.actor === null
      ? undefined
      : `/${locale}/comment/${notification.commentId}`;
  }
  return Option.getOrUndefined(
    Option.map(pageOf(notification), (url) => url.href)
  );
}
