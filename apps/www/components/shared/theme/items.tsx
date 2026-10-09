"use client";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { themeOptions } from "@repo/design-system/lib/theme/options";
import { IconCircleFilled } from "@tabler/icons-react";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

const BASE_THEMES_COUNT = 3;

/** Shows the selected theme without affecting the item hit target. */
function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <IconCircleFilled
      className={cn(
        "ml-auto size-3 text-primary opacity-0 transition-opacity",
        isActive && "opacity-100"
      )}
    />
  );
}

/** Renders one group of themes while leaving the selected theme in next-themes. */
function ThemeGroup({ options }: { options: typeof themeOptions }) {
  const { theme: currentTheme, setTheme } = useTheme();
  const t = useTranslations("Common");

  return (
    <DropdownMenuGroup>
      {Arr.map(options, (theme) => (
        <DropdownMenuItem
          className="cursor-pointer"
          key={theme.value}
          onClick={() => setTheme(theme.value)}
        >
          <HugeIcons className="shrink-0" icon={theme.icon} />
          <span className="truncate">{t(theme.value)}</span>
          <ActiveBadge isActive={currentTheme === theme.value} />
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

/**
 * Lists light, dark and system first, then every named theme.
 *
 * The theme list carries one icon for each theme, about 31 kB, so every menu
 * that shows it loads this module on demand instead of with the page.
 */
export function ThemeMenuItems() {
  return (
    <>
      <ThemeGroup options={Arr.take(themeOptions, BASE_THEMES_COUNT)} />
      <DropdownMenuSeparator />
      <ThemeGroup options={Arr.drop(themeOptions, BASE_THEMES_COUNT)} />
    </>
  );
}
