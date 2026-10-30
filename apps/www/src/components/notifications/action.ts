import { useMutation } from "@confect/react";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Match, Option } from "effect";
import { type MouseEvent, use } from "react";
import { useTranslations } from "use-intl";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { pageOf } from "@/components/notifications/destination";
import { markReadInLists } from "@/components/notifications/mutation";
import { navigationOf } from "@/components/notifications/press";
import type { ListNotification } from "@/components/notifications/state";
import { useAgeNow } from "@/components/user/ages";
import { reportClientException } from "@/lib/analytics/client";

/** The moment the ages of the inbox count from, which the feed's timer moves forward. */
export function useNotificationsNow() {
  const clock = use(NotificationsClockContext);

  if (!clock) {
    throw new Error(
      "useNotificationsNow must be used within the notifications page"
    );
  }

  return useAgeNow(clock);
}

/**
 * What a row of the inbox says and does, wherever the row is drawn: the sentence that says what happened, the page it
 * opens, whether it is read, and its presses. Pressing the row marks it read at once. A plain press on a row with a
 * page moves to that page once the server has taken the read, because a full move would cut off a read that is still
 * on its way; a refused read stays where it is, rolled back, with its toast. Any other press leaves the link to the
 * browser, so a modifier click or a middle click opens it in a new tab.
 */
export function useNotificationAction(notification: ListNotification) {
  const t = useTranslations("Notifications");
  const readOne = useMutation(notifications.inbox.read).withOptimisticUpdate(
    markReadInLists
  );
  const { detail, readAt } = notification;
  const href = Option.getOrUndefined(
    Option.map(pageOf(notification), (url) => url.href)
  );
  const sentence = Match.value(notification.changeType).pipe(
    Match.when("person.invited", () => t("person-invited")),
    Match.when("forum.mentioned", () =>
      detail === null
        ? t("forum-mentioned-gone")
        : t("forum-mentioned", {
            actor: detail.actor,
            className: detail.className,
          })
    ),
    Match.when("assignment.published", () =>
      detail === null
        ? t("assignment-published-gone")
        : t("assignment-published", {
            actor: detail.actor,
            className: detail.className,
          })
    ),
    Match.when("announcement.posted", () =>
      detail === null
        ? t("announcement-posted-gone")
        : t("announcement-posted", {
            actor: detail.actor,
            className: detail.className,
          })
    ),
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
   * refused read keeps the learner where the rollback and the toast show.
   */
  function onPress(event: MouseEvent<HTMLElement>) {
    if (href === undefined || navigationOf(event) === "browser") {
      Effect.runPromise(markRead);
      return;
    }
    event.preventDefault();
    // A row's page is on the school's own host, which the browser opens.
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
  function onAuxPress(event: MouseEvent<HTMLElement>) {
    if (event.button === 1) {
      Effect.runPromise(markRead);
    }
  }

  return { href, onAuxPress, onPress, read: readAt !== undefined, sentence };
}
