"use client";

import { PaintBoardIcon, TranslateIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { themeOptions } from "@repo/design-system/lib/theme/options";
import { cn } from "@repo/design-system/lib/utils";
import { languages } from "@repo/internationalization/data/lang";
import { IconCircleFilled } from "@tabler/icons-react";
import GB from "country-flag-icons/react/3x2/GB";
import ID from "country-flag-icons/react/3x2/ID";
import { type Locale, useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useLocalizedRouteSwitch } from "@/lib/routing/locale/client";

const BASE_THEMES_COUNT = 3;

const flagMap = {
  en: GB,
  id: ID,
};

/** Dropdown side contract inherited from the design-system submenu content. */
type SubmenuSide = React.ComponentProps<typeof DropdownMenuSubContent>["side"];

/** Shows the active menu option without changing the item label layout. */
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

/** Renders the nested language submenu and delegates route projection to the shared switcher seam. */
function LanguageSubmenuContent({ side }: { side: SubmenuSide }) {
  const { isPending, replace } = useLocalizedRouteSwitch();
  const currentLocale = useLocale();

  /** Replaces the current route with the selected locale. */
  function handleChangeLocale(locale: Locale) {
    replace(locale);
  }

  return (
    <DropdownMenuSubContent
      className="w-max max-w-[calc(100vw-2rem)]"
      side={side}
    >
      <DropdownMenuGroup>
        {languages.map((language) => {
          const Flag = flagMap[language.value];

          return (
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              key={language.value}
              onClick={() => handleChangeLocale(language.value)}
            >
              <Flag className="size-4 shrink-0" />
              <span className="truncate">{language.label}</span>
              <ActiveBadge isActive={currentLocale === language.value} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    </DropdownMenuSubContent>
  );
}

/** Renders the nested theme submenu while keeping theme state owned by next-themes. */
function ThemeSubmenuContent({ side }: { side: SubmenuSide }) {
  const { theme: currentTheme, setTheme } = useTheme();
  const t = useTranslations("Common");

  function isActive(value: string) {
    return currentTheme === value;
  }

  return (
    <DropdownMenuSubContent
      className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-2rem)]"
      side={side}
    >
      <DropdownMenuGroup>
        {themeOptions.slice(0, BASE_THEMES_COUNT).map((theme) => (
          <DropdownMenuItem
            className="cursor-pointer"
            key={theme.value}
            onClick={() => setTheme(theme.value)}
          >
            <HugeIcons className="shrink-0" icon={theme.icon} />
            <span className="truncate">{t(theme.value)}</span>
            <ActiveBadge isActive={isActive(theme.value)} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        {themeOptions.slice(BASE_THEMES_COUNT).map((theme) => (
          <DropdownMenuItem
            className="cursor-pointer"
            key={theme.value}
            onClick={() => setTheme(theme.value)}
          >
            <HugeIcons className="shrink-0" icon={theme.icon} />
            <span className="truncate">{t(theme.value)}</span>
            <ActiveBadge isActive={isActive(theme.value)} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuSubContent>
  );
}

/** Provides the sidebar preference submenus that can be mounted from account menu surfaces. */
export function SidebarPreferenceSubmenus({ side }: { side: SubmenuSide }) {
  const t = useTranslations("Common");

  return (
    <DropdownMenuGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer">
          <HugeIcons icon={TranslateIcon} />
          <span className="truncate">{t("language")}</span>
        </DropdownMenuSubTrigger>
        <LanguageSubmenuContent side={side} />
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer">
          <HugeIcons icon={PaintBoardIcon} />
          <span className="truncate">{t("theme")}</span>
        </DropdownMenuSubTrigger>
        <ThemeSubmenuContent side={side} />
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
}
