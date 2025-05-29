import { IconBrandDiscord } from "@tabler/icons-react";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SidebarMenuButton } from "../ui/sidebar";
import { SidebarMenuItem } from "../ui/sidebar";

export function CommunityButton() {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={t("community")} asChild>
        <a
          href="https://discord.gg/CPCSfKhvfQ"
          title={t("community")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconBrandDiscord className="size-4 shrink-0" />
          <span className="truncate">{t("community")}</span>

          <ExternalLinkIcon className="ml-auto size-4 shrink-0" />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
