import { Globe02Icon, SchoolIcon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, DateTime, Option } from "effect";
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
        {/* The school choice, then the page's two buttons in one group, ready and final from the first paint. */}
        <InboxFilter all={all} />
        <ButtonGroup>
          <MarkAllRead scope={scope} />
          <SchoolPreferences />
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

/**
 * The header's choice of schools, as the unit choice of a settings page reads: this school's rows, or every school's,
 * kept in the page's address. It opens with its one-word label, and each school choice shows its icon. The trigger
 * shows the chosen icon and folds its words in a narrow header (`HeaderLabel`), as the header's buttons beside it do.
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
    <Select
      items={items}
      onValueChange={(value) =>
        navigate({
          params: { slug },
          search: value === "all" ? { schools: "all" } : {},
          to: "/school/$slug/notifications",
        })
      }
      value={chosen.value}
    >
      <SelectTrigger aria-label={common("menu-schools")} className="w-auto">
        <SelectValue>
          <HugeIcons icon={chosen.icon} />
          <HeaderLabel>{chosen.label}</HeaderLabel>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{common("menu-schools")}</SelectLabel>
          {Arr.map(items, (item) => (
            <SelectItem key={item.value} value={item.value}>
              <HugeIcons icon={item.icon} />
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
