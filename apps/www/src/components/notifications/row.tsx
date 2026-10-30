import { cn } from "cn";
import type { MouseEvent, ReactNode } from "react";
import { useLocale } from "use-intl";
import {
  useNotificationAction,
  useNotificationsNow,
} from "@/components/notifications/action";
import type { ListNotification } from "@/components/notifications/state";
import { SchoolMark } from "@/components/tenant/mark";
import { formatShortAge } from "@/components/user/age";
import {
  FeedAge,
  FeedBody,
  FeedHeader,
  FeedName,
  FeedRow,
} from "@/components/user/feed";

/**
 * One row of the inbox, in the anatomy of the profile rows: the school's mark, then
 * the school's name and the age, then the sentence that says what happened. An
 * unread row's sentence is in the foreground and bold, and a read row's is muted.
 */
export function NotificationRow({
  notification,
}: {
  notification: ListNotification;
}) {
  const locale = useLocale();
  const now = useNotificationsNow();
  const { sentence, ...action } = useNotificationAction(notification);
  const { createdAt, tenant } = notification;

  return (
    <FeedRow>
      <SchoolMark logo={tenant.logo} mascot={tenant.mascot} />
      <FeedBody>
        <FeedHeader>
          <FeedName>{tenant.name}</FeedName>
          <FeedAge at={createdAt}>
            {formatShortAge(createdAt, now, locale)}
          </FeedAge>
        </FeedHeader>
        <NotificationAction {...action}>{sentence}</NotificationAction>
      </FeedBody>
    </FeedRow>
  );
}

/**
 * The sentence of a row, as a link across the whole row to the page it opens, or as
 * a button across the whole row when its subject has no page. The link is a real
 * link, so a modifier click or a middle click opens it as the browser opens any link.
 * The overlay of `after:` covers the row, as the chats list does.
 */
export function NotificationAction({
  children,
  href,
  onAuxPress,
  onPress,
  read,
}: {
  children: ReactNode;
  href: string | undefined;
  onAuxPress: (event: MouseEvent<HTMLElement>) => void;
  onPress: (event: MouseEvent<HTMLElement>) => void;
  read: boolean;
}) {
  const className = cn(
    "wrap-anywhere rounded-sm text-start outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    read ? "text-muted-foreground" : "font-medium text-foreground"
  );

  if (href === undefined) {
    return (
      <button className={className} onClick={onPress} type="button">
        {children}
      </button>
    );
  }
  return (
    <a
      className={className}
      href={href}
      onAuxClick={onAuxPress}
      onClick={onPress}
    >
      {children}
    </a>
  );
}
