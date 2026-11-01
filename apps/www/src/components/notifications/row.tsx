import { photoOf } from "@repo/backend/confect/users/picture";
import { cn } from "cn";
import type { MouseEvent, ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  useNotificationAction,
  useNotificationsNow,
} from "@/components/notifications/action";
import type {
  ListNotification,
  SchoolNotification,
} from "@/components/notifications/state";
import { SchoolMark } from "@/components/tenant/mark";
import { formatShortAge } from "@/components/user/age";
import {
  FeedAge,
  FeedAvatar,
  FeedBody,
  FeedHeader,
  FeedName,
  FeedRow,
} from "@/components/user/feed";

/** One row of the inbox: a reply shows who wrote it, and any other row its school. */
export function NotificationRow({
  notification,
}: {
  notification: ListNotification;
}) {
  return notification.changeType === "comment.replied" ? (
    <ReplyRow notification={notification} />
  ) : (
    <SchoolRow notification={notification} />
  );
}

/**
 * A school's row, in the anatomy of the profile rows: the school's mark, then the
 * school's name and the age, then the sentence that says what happened. An unread
 * row's sentence is in the foreground and bold, and a read row's is muted.
 */
function SchoolRow({ notification }: { notification: SchoolNotification }) {
  const { tenant } = notification;

  return (
    <FeedRow>
      <SchoolMark logo={tenant.logo} mascot={tenant.mascot} />
      <NotificationBody name={tenant.name} notification={notification} />
    </FeedRow>
  );
}

/** A reply's row: the writer's picture and name, in the anatomy of a school's row. */
function ReplyRow({
  notification,
}: {
  notification: Exclude<ListNotification, SchoolNotification>;
}) {
  const t = useTranslations("Common");
  const { actor } = notification;

  return (
    <FeedRow>
      <FeedAvatar mascot={actor?.mascot} photo={photoOf(actor ?? {})} />
      <NotificationBody
        name={actor?.name ?? t("anonymous")}
        notification={notification}
      />
    </FeedRow>
  );
}

/** The name and the age of a row, then the sentence that says what happened. */
function NotificationBody({
  name,
  notification,
}: {
  name: string;
  notification: ListNotification;
}) {
  const locale = useLocale();
  const now = useNotificationsNow();
  const { sentence, ...action } = useNotificationAction(notification);
  const { createdAt } = notification;

  return (
    <FeedBody>
      <FeedHeader>
        <FeedName>{name}</FeedName>
        <FeedAge at={createdAt}>
          {formatShortAge(createdAt, now, locale)}
        </FeedAge>
      </FeedHeader>
      <NotificationAction {...action}>{sentence}</NotificationAction>
    </FeedBody>
  );
}

/**
 * The sentence of a row, as a link across the whole row to the page it opens, or as
 * a button across the whole row when its subject has no page. The link is a real
 * link, so a modifier click or a middle click opens it as the browser opens any link.
 * The overlay of `after:` covers the row, as the chats list does.
 */
function NotificationAction({
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
    "focus-visible:ring-ring rounded-sm text-start wrap-anywhere outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-inset",
    read ? "text-muted-foreground" : "text-foreground font-medium"
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
