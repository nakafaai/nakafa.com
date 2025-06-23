import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { IconBrandDiscord } from "@tabler/icons-react";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function CommunityButton() {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={t("community")}>
        <a
          href="https://discord.gg/CPCSfKhvfQ"
          rel="noopener noreferrer"
          target="_blank"
          title={t("community")}
        >
          <IconBrandDiscord className="size-4 shrink-0" />
          <span className="truncate">{t("community")}</span>

          <ExternalLinkIcon className="ml-auto size-4 shrink-0" />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
