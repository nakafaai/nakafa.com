"use client";

import { cn } from "@/lib/utils";
import { IconCircleFilled } from "@tabler/icons-react";
import {
  AsteriskIcon,
  CatIcon,
  ChevronRightIcon,
  ClockIcon,
  CloudyIcon,
  CoffeeIcon,
  CpuIcon,
  HeartIcon,
  LaptopIcon,
  LeafIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
  SunsetIcon,
  TvIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMediaQuery } from "usehooks-ts";
import {
  DropdownMenu,
  DropdownMenuContent,
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

        <DropdownMenuContent side={isMobile ? "top" : "right"} align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <SunIcon className="size-4 shrink-0" />
            <span className="truncate">{t("light")}</span>
            <CheckerBadge isActive={isActive("light")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <MoonIcon className="size-4 shrink-0" />
            <span className="truncate">{t("dark")}</span>
            <CheckerBadge isActive={isActive("dark")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("system")}>
            <LaptopIcon className="size-4 shrink-0" />
            <span className="truncate">{t("system")}</span>
            <CheckerBadge isActive={isActive("system")} />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setTheme("caffeine")}>
            <CoffeeIcon className="size-4 shrink-0" />
            <span className="truncate">{t("caffeine")}</span>
            <CheckerBadge isActive={isActive("caffeine")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("claude")}>
            <AsteriskIcon className="size-4 shrink-0" />
            <span className="truncate">Claude</span>
            <CheckerBadge isActive={isActive("claude")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("dreamy")}>
            <CloudyIcon className="size-4 shrink-0" />
            <span className="truncate">{t("dreamy")}</span>
            <CheckerBadge isActive={isActive("dreamy")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("ghibli")}>
            <CatIcon className="size-4 shrink-0" />
            <span className="truncate">Ghibli</span>
            <CheckerBadge isActive={isActive("ghibli")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("nature")}>
            <LeafIcon className="size-4 shrink-0" />
            <span className="truncate">{t("nature")}</span>
            <CheckerBadge isActive={isActive("nature")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("neo")}>
            <CpuIcon className="size-4 shrink-0" />
            <span className="truncate">Neo</span>
            <CheckerBadge isActive={isActive("neo")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("perpetuity")}>
            <ClockIcon className="size-4 shrink-0" />
            <span className="truncate">{t("perpetuity")}</span>
            <CheckerBadge isActive={isActive("perpetuity")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("pinky")}>
            <HeartIcon className="size-4 shrink-0" />
            <span className="truncate">Pinky</span>
            <CheckerBadge isActive={isActive("pinky")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("retro")}>
            <TvIcon className="size-4 shrink-0" />
            <span className="truncate">Retro</span>
            <CheckerBadge isActive={isActive("retro")} />
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setTheme("sunset")}>
            <SunsetIcon className="size-4 shrink-0" />
            <span className="truncate">{t("sunset")}</span>
            <CheckerBadge isActive={isActive("sunset")} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </SidebarMenuItem>
    </DropdownMenu>
  );
}
