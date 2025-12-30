"use client";

import { ArrowRight01Icon, PaintBoardIcon } from "@hugeicons/core-free-icons";
import { useMediaQuery } from "@mantine/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { themes } from "@repo/design-system/lib/theme";
import { cn } from "@repo/design-system/lib/utils";
import { IconCircleFilled } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

const BASE_THEMES_COUNT = 3;

function CheckerBadge({ isActive }: { isActive: boolean }) {
  return (
    <IconCircleFilled
      className={cn(
        "ml-auto size-3 text-primary opacity-0 transition-opacity",
        !!isActive && "opacity-100"
      )}
    />
  );
}

export function ThemeMenu() {
  const { theme: currentTheme, setTheme } = useTheme();
  const t = useTranslations("Common");

  const isMobile = useMediaQuery("(max-width: 640px)");

  function isActive(value: string) {
    return currentTheme === value;
  }

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t("theme")}>
            <HugeIcons icon={PaintBoardIcon} />
            <span className="truncate">{t("theme")}</span>

            <HugeIcons className="ml-auto" icon={ArrowRight01Icon} />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="max-h-96"
          side={isMobile ? "top" : "right"}
        >
          <DropdownMenuGroup>
            {themes.slice(0, BASE_THEMES_COUNT).map((theme) => (
              <DropdownMenuItem
                className="cursor-pointer"
                key={theme.value}
                onSelect={() => setTheme(theme.value)}
              >
                <HugeIcons className="shrink-0" icon={theme.icon} />
                <span className="truncate">{t(theme.value)}</span>
                <CheckerBadge isActive={isActive(theme.value)} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {themes.slice(BASE_THEMES_COUNT).map((theme) => (
              <DropdownMenuItem
                className="cursor-pointer"
                key={theme.value}
                onSelect={() => setTheme(theme.value)}
              >
                <HugeIcons className="shrink-0" icon={theme.icon} />
                <span className="truncate">{t(theme.value)}</span>
                <CheckerBadge isActive={isActive(theme.value)} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </SidebarMenuItem>
    </DropdownMenu>
  );
}
