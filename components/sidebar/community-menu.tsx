import { IconBrandDiscord } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { SidebarMenuButton } from "../ui/sidebar";
import { SidebarMenuItem } from "../ui/sidebar";

export function CommunityMenu() {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={t("community")} asChild>
        <a
          href="https://discord.gg/EW9VN4gWzf"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconBrandDiscord className="size-4 shrink-0" />
          <span className="truncate">{t("community")}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
