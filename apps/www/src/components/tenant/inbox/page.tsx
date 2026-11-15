import { Globe02Icon, SchoolIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, DateTime, Option } from "effect";
import { useTranslations } from "use-intl";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { NotificationsList } from "@/components/notifications/list";
import { MarkAllRead } from "@/components/notifications/read";
import { InboxTabs } from "@/components/notifications/tabs";
import { SchoolInboxTopic } from "@/components/notifications/topic";
import { PageStack } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import { PageHeaderLabel } from "@/components/shared/page/header";
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
    <Page width="column">
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        {/* The school choice and the page's two buttons are one group of equal parts, ready and final from the first paint. */}
        <ButtonGroup>
          <InboxFilter all={all} />
          <MarkAllRead scope={scope} />
          <SchoolPreferences />
        </ButtonGroup>
      </SchoolHeader>
      <InboxTabs topics={SchoolInboxTopic.literals} />
      <PageStack>
        <NotificationsClockContext value={clock}>
          <NotificationsList first={Option.none()} scope={scope} />
        </NotificationsClockContext>
      </PageStack>
    </Page>
  );
}

/**
 * The header's choice of schools: this school's rows, or every school's, kept in the page's address. Its button shows
 * the chosen school's icon and folds its words in a narrow header (`PageHeaderLabel`), as the header's buttons beside it
 * do, so the three stand as equal parts of one group on a phone. The menu opens with its one-word label, and each
 * choice shows its icon.
 */
function InboxFilter({ all }: { all: boolean }) {
  const t = useTranslations("Notifications");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const navigate = useNavigate();
  const thisSchool = {
    icon: SchoolIcon,
    label: t("this-school"),
    value: "school",
  } as const;
  const allSchools = {
    icon: Globe02Icon,
    label: t("all-schools"),
    value: "all",
  } as const;
  const items = [thisSchool, allSchools] as const;
  const chosen = all ? allSchools : thisSchool;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={common("menu-schools")}>
            <HugeIcons icon={chosen.icon} />
            <PageHeaderLabel>{chosen.label}</PageHeaderLabel>
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-56"
        label={common("menu-schools")}
      >
        <DropdownMenuRadioGroup
          onValueChange={(value) =>
            navigate({
              params: { slug },
              search: value === "all" ? { schools: "all" } : {},
              to: "/school/$slug/notifications",
            })
          }
          value={chosen.value}
        >
          {Arr.map(items, (item) => (
            <DropdownMenuRadioItem
              icon={item.icon}
              key={item.value}
              value={item.value}
            >
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
