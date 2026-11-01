import {
  FilterHorizontalIcon,
  Globe02Icon,
  SchoolIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useNavigate } from "@tanstack/react-router";
import { DateTime, Option } from "effect";
import { useTranslations } from "use-intl";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { NotificationsList } from "@/components/notifications/list";
import { MarkAllRead } from "@/components/notifications/read";
import { InboxTabs } from "@/components/notifications/tabs";
import { SchoolInboxTopic } from "@/components/notifications/topic";
import { HeaderLabel } from "@/components/shared/breadcrumb/frame";
import { LayoutContent, PageFrame } from "@/components/shared/content/frame";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { SchoolPreferences } from "@/components/tenant/inbox/preferences";
import { useAgeClock } from "@/components/user/ages";

/**
 * The account's notifications inside the School, as the Nakafa inbox shows them: this school's
 * rows by default, or every school's when the header's filter says so. The rows read the live
 * inbox once the session settles, so the page commits at once and reads nothing on the server.
 */
export function SchoolNotifications({ all }: { all: boolean }) {
  const t = useTranslations("Notifications");
  const { slug } = useTenant();
  const scope = all ? {} : { slug };
  const clock = useAgeClock(DateTime.toEpochMillis(DateTime.nowUnsafe()));

  return (
    <PageFrame width="column">
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        {/* Mark all read stands before the filter from the first paint, ready and final. */}
        <ButtonGroup>
          <MarkAllRead first={Option.none()} scope={scope} />
          <SchoolPreferences />
          <InboxFilter all={all} />
        </ButtonGroup>
      </SchoolHeader>
      <InboxTabs topics={SchoolInboxTopic.literals} />
      <LayoutContent className="flex w-full flex-col py-6">
        <NotificationsClockContext value={clock}>
          <NotificationsList first={Option.none()} scope={scope} />
        </NotificationsClockContext>
      </LayoutContent>
    </PageFrame>
  );
}

/** The header's filter: this school's rows, or every school's, kept in the page's address. */
function InboxFilter({ all }: { all: boolean }) {
  const t = useTranslations("Notifications");
  const { slug } = useTenant();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline">
            <HugeIcons icon={FilterHorizontalIcon} />
            <HeaderLabel>
              {all ? t("all-schools") : t("this-school")}
            </HeaderLabel>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            onValueChange={(value) =>
              navigate({
                params: { slug },
                search: value === "all" ? { schools: "all" } : {},
                to: "/school/$slug/notifications",
              })
            }
            value={all ? "all" : "school"}
          >
            <DropdownMenuRadioItem value="school">
              <HugeIcons icon={SchoolIcon} />
              {t("this-school")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="all">
              <HugeIcons icon={Globe02Icon} />
              {t("all-schools")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
