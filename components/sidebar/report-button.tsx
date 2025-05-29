import { BugIcon, ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SidebarMenuButton } from "../ui/sidebar";
import { SidebarMenuItem } from "../ui/sidebar";

export function ReportButton() {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={t("report")} asChild>
        <a
          href="https://github.com/nabilfatih/nakafa.com/issues/new/choose"
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
