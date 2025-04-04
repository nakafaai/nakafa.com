"use client";

import {
  ChevronRightIcon,
  LaptopIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMediaQuery } from "usehooks-ts";
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

  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t("theme")}>
            <PaletteIcon className="size-4" />
            <span className="truncate">{t("theme")}</span>

            <ChevronRightIcon className="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={isMobile ? "top" : "right"}
          align={isMobile ? "end" : "center"}
        >
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
      </SidebarMenuItem>
    </DropdownMenu>
  );
}
