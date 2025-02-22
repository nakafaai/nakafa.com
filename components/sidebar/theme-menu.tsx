"use client";

import {
  ChevronRightIcon,
  LaptopIcon,
  MoonIcon,
  SunIcon,
  SunMoonIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export function ThemeMenu() {
  const { setTheme } = useTheme();
  const t = useTranslations("Common");

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t("theme")}>
            <SunMoonIcon className="size-4" />
            <span className="truncate">{t("theme")}</span>

            <ChevronRightIcon className="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="right">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <SunIcon className="size-4" />
            <span className="truncate">{t("light")}</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <MoonIcon className="size-4" />
            <span className="truncate">{t("dark")}</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("system")}>
            <LaptopIcon className="size-4" />
            <span className="truncate">{t("system")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
