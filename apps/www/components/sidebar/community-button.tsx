import { DiscordIcon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
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
          <HugeIcons className="size-4 shrink-0" icon={DiscordIcon} />
          <span className="truncate">{t("community")}</span>

          <HugeIcons
            className="ml-auto size-4 shrink-0"
            icon={LinkSquare02Icon}
          />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
