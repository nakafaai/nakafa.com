import { Option } from "effect";
import type { ListNotification } from "@/components/notifications/state";
import { schoolOrigin } from "@/lib/routing/school/host";

/**
 * The page that a row opens, on the school's own host, when its subject has one. An invitation
 * opens the home of the school. A mention opens its message, in its discussion when it is a reply
 * and in its channel otherwise, an announcement opens the class home, and a new task opens its page,
 * each while the server gives the row its detail. Any other row has no page, so it only marks itself read.
 */
export function pageOf(notification: ListNotification): Option.Option<URL> {
  const origin = schoolOrigin(notification.tenant.slug);
  if (notification.subject.kind === "person") {
    return Option.some(origin);
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
