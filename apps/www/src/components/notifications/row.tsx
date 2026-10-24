import { useMutation } from "@confect/react";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { toast } from "@repo/design-system/lib/toast/notify";
import { cn } from "cn";
import { Effect, Match, Option } from "effect";
import { type MouseEvent, type ReactNode, use } from "react";
import { useLocale, useTranslations } from "use-intl";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { pageOf } from "@/components/notifications/destination";
import { markReadInLists } from "@/components/notifications/mutation";
import { navigationOf } from "@/components/notifications/press";
import type { ListNotification } from "@/components/notifications/state";
import { SchoolMark } from "@/components/tenant/mark";
import { formatShortAge } from "@/components/user/age";
import { useAgeNow } from "@/components/user/ages";
import {
  FeedAge,
  FeedBody,
  FeedHeader,
  FeedName,
  FeedRow,
} from "@/components/user/feed";
import { reportClientException } from "@/lib/analytics/client";

/** The moment the ages of the inbox count from, which the feed's timer moves forward. */
function useNotificationsNow() {
  const clock = use(NotificationsClockContext);

  if (!clock) {
    throw new Error(
      "useNotificationsNow must be used within the notifications page"
    );
  }

  return useAgeNow(clock);
}

/**
 * One row of the inbox, in the anatomy of the profile rows: the school's mark, then
 * the school's name and the age, then the sentence that says what happened. An
 * unread row's sentence is in the foreground and bold, and a read row's is muted.
 * Pressing the row marks it read at once. A plain press on a row with a page moves
 * to that page once the server has taken the read, because a full move would cut off
 * a read that is still on its way; a refused read stays on the inbox, rolled back, with
 * its toast. Any other press leaves the link to the browser, so a modifier click or a
 * middle click opens it in a new tab.
 */
export function NotificationRow({
  notification,
}: {
  notification: ListNotification;
}) {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const now = useNotificationsNow();
  const readOne = useMutation(notifications.inbox.read).withOptimisticUpdate(
    markReadInLists
  );
  const { createdAt, readAt, tenant } = notification;
  const href = Option.getOrUndefined(
    Option.map(pageOf(notification), (url) => url.href)
  );
  const sentence = Match.value(notification.changeType).pipe(
    Match.when("person.invited", () => t("person-invited")),
    Match.exhaustive
  );
  // The change shows at once. The server's answer ends the effect: a refusal is reported
  // with the shared error toast, and the effect resolves to whether the server took the
  // read. The effect never fails.
  const markRead =
    readAt === undefined
      ? Effect.tryPromise(() =>
          readOne({ notificationId: notification.id })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onSuccess: () => Effect.succeed(true),
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/notifications/row",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error({
                      title: "action-error.title",
                      description: "action-error.description",
                    });
                  })
                ),
                Effect.as(false)
              ),
          })
        )
      : Effect.succeed(true);

  /**
   * A press on the row. A plain press on a row with a page waits for the read to settle,
   * then moves to the page, so the browser never leaves before the read is taken. A
   * refused read keeps the learner on the inbox, where the rollback and the toast show.
   */
  function press(event: MouseEvent<HTMLElement>) {
    if (href === undefined || navigationOf(event) === "browser") {
      Effect.runPromise(markRead);
      return;
    }
    event.preventDefault();
    Effect.runPromise(
      markRead.pipe(
        Effect.flatMap((taken) =>
          Effect.sync(() => {
            if (taken) {
              window.location.assign(href);
            }
          })
        )
      )
    );
  }

  /** A middle click opens the link in a new tab as usual, and marks the row read. */
  function pressWithMiddleButton(event: MouseEvent<HTMLElement>) {
    if (event.button === 1) {
      Effect.runPromise(markRead);
    }
  }

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
        <NotificationAction
          href={href}
          onAuxPress={pressWithMiddleButton}
          onPress={press}
          read={readAt !== undefined}
        >
          {sentence}
        </NotificationAction>
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
