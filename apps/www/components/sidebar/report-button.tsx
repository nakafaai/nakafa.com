import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { BugIcon, ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function ReportButton() {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={t("report")} asChild>
        <a
          href="https://github.com/nakafaai/nakafa.com/issues/new/choose"
          title={t("report")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BugIcon className="size-4 shrink-0" />
          <span className="truncate">{t("report")}</span>

          <ExternalLinkIcon className="ml-auto size-4 shrink-0" />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
