"use client";

import { themes } from "@/lib/data/theme";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@mantine/hooks";
import { IconCircleFilled } from "@tabler/icons-react";
import { ChevronRightIcon, PaletteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

function CheckerBadge({ isActive }: { isActive: boolean }) {
  return (
    <IconCircleFilled
      className={cn(
        "ml-auto size-3 text-primary opacity-0 transition-opacity",
        isActive && "opacity-100"
      )}
    />
  );
}

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("Common");

  const isMobile = useMediaQuery("(max-width: 640px)");

  const isActive = (value: string) => theme === value;

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t("theme")}>
            <PaletteIcon className="size-4 shrink-0" />
            <span className="truncate">{t("theme")}</span>

            <ChevronRightIcon className="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={isMobile ? "top" : "right"}
          align="end"
          className="max-h-96"
        >
          <DropdownMenuGroup>
            {themes.slice(0, 3).map((theme) => (
              <DropdownMenuItem
                key={theme.value}
                onClick={() => setTheme(theme.value)}
              >
                <theme.icon className="size-4 shrink-0" />
                <span className="truncate">{t(theme.value)}</span>
                <CheckerBadge isActive={isActive(theme.value)} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {themes.slice(3).map((theme) => (
              <DropdownMenuItem
                key={theme.value}
                onClick={() => setTheme(theme.value)}
              >
                <theme.icon className="size-4 shrink-0" />
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
