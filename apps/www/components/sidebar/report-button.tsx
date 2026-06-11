import { Bug02Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";

export function ReportButton() {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <a
            aria-label={t("report")}
            href="https://github.com/nakafaai/nakafa.com/issues/new/choose"
            rel="noopener noreferrer"
            target="_blank"
            title={t("report")}
          >
            <HugeIcons className="size-4 shrink-0" icon={Bug02Icon} />
            <span className="truncate">{t("report")}</span>
            <HugeIcons
              className="ml-auto size-4 shrink-0"
              icon={LinkSquare02Icon}
            />
          </a>
        }
        tooltip={t("report")}
      />
    </SidebarMenuItem>
  );
}
