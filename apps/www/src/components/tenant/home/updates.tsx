import { ItemContent } from "@repo/design-system/components/ui/item";
import { Array as Arr, DateTime, Option } from "effect";
import { useLocale, useTranslations } from "use-intl";
import {
  useNotificationAction,
  useNotificationsNow,
} from "@/components/notifications/action";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { useInbox } from "@/components/notifications/inbox";
import { NotificationAction } from "@/components/notifications/row";
import type { ListNotification } from "@/components/notifications/state";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { useTenant } from "@/components/tenant/context";
import {
  HomeCard,
  HomeQuiet,
  HomeRow,
  HomeSection,
} from "@/components/tenant/home/section";
import { formatShortAge } from "@/components/user/age";
import { useAgeClock } from "@/components/user/ages";
import { TargetLink } from "@/lib/routing/link";
import { schoolNotificationsTarget } from "@/lib/routing/school/target";

/** How many of the school's newest updates the home shows; the rest are a press away. */
const HOME_UPDATES = 5;

/**
 * What happened in the school for the viewer, newest first: the school's own notifications, such as an announcement, a
 * new task or a mention, each a row that opens what it is about and marks it read, with its age at the end. The
 * section links to every update. A school with nothing yet says so in one sentence, and a failed read shows its own
 * sentence and Try again above the rows it still holds.
 */
export function UpdatesSection() {
  const t = useTranslations("School");
  const { slug } = useTenant();
  const clock = useAgeClock(DateTime.toEpochMillis(DateTime.nowUnsafe()));
  const { empty, failed, ready, rows } = useInbox(Option.none(), slug);

  // The section draws once the inbox has answered, so it never shows an empty card first.
  if (!ready) {
    return null;
  }
  return (
    <HomeSection
      action={
        <TargetLink
          className="rounded-sm font-medium text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          target={schoolNotificationsTarget(slug)}
        >
          {t("home-updates-all")}
        </TargetLink>
      }
      title={t("home-updates")}
    >
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {empty ? <HomeQuiet>{t("home-updates-empty")}</HomeQuiet> : null}
      {Arr.isReadonlyArrayNonEmpty(rows) ? (
        <NotificationsClockContext value={clock}>
          <HomeCard>
            {Arr.map(Arr.take(rows, HOME_UPDATES), (notification) => (
              <UpdateRow key={notification.id} notification={notification} />
            ))}
          </HomeCard>
        </NotificationsClockContext>
      ) : null}
    </HomeSection>
  );
}

/**
 * One update as a row: its sentence, bold while it is unread, as the link across the whole row, and its age at the
 * end, which moves under the sentence when the row is narrow.
 */
function UpdateRow({ notification }: { notification: ListNotification }) {
  const locale = useLocale();
  const now = useNotificationsNow();
  const { sentence, ...action } = useNotificationAction(notification);

  return (
    <HomeRow className="relative hover:bg-muted">
      <ItemContent className="min-w-0 basis-48">
        <NotificationAction {...action}>{sentence}</NotificationAction>
      </ItemContent>
      <span className="text-muted-foreground text-sm tabular-nums">
        {formatShortAge(notification.createdAt, now, locale)}
      </span>
    </HomeRow>
  );
}
