import { Option } from "effect";
import type { ListNotification } from "@/components/notifications/state";
import { schoolOrigin } from "@/lib/routing/school/host";

/**
 * The page that a row opens, when its subject has one. An invitation's subject is
 * the Person it invites, and its page is the home of the school on its school host.
 * A subject of any other kind has no page, so its row only marks itself read.
 */
export function pageOf(notification: ListNotification): Option.Option<URL> {
  if (notification.subject.kind === "person") {
    return Option.some(schoolOrigin(notification.tenant.slug));
  }
  return Option.none();
}
