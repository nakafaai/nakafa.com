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
import { themes } from "@repo/design-system/lib/theme";
import { cn } from "@repo/design-system/lib/utils";
import { languages } from "@repo/internationalization/data/lang";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { IconCircleFilled } from "@tabler/icons-react";
import GB from "country-flag-icons/react/3x2/GB";
import ID from "country-flag-icons/react/3x2/ID";
import { useParams } from "next/navigation";
import { type Locale, useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useTransition } from "react";

const BASE_THEMES_COUNT = 3;

const flagMap = {
  en: GB,
  id: ID,
};

type SubmenuSide = React.ComponentProps<typeof DropdownMenuSubContent>["side"];

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

function LanguageSubmenuContent({ side }: { side: SubmenuSide }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = useLocale();

  function handlePrefetch(locale: Locale) {
    router.prefetch(
      // @ts-expect-error -- The current route pathname and params are paired by Next.
      { pathname, params },
      { locale }
    );
  }

  function handleChangeLocale(locale: Locale) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- The current route pathname and params are paired by Next.
        { pathname, params },
        { locale }
      );
    });
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
              onFocus={() => handlePrefetch(language.value)}
              onMouseEnter={() => handlePrefetch(language.value)}
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

function ThemeSubmenuContent({ side }: { side: SubmenuSide }) {
  const { theme: currentTheme, setTheme } = useTheme();
  const t = useTranslations("Common");

  function isActive(value: string) {
    return currentTheme === value;
  }

  return (
    <DropdownMenuSubContent
      className="max-h-96 w-max max-w-[calc(100vw-2rem)]"
      side={side}
    >
      <DropdownMenuGroup>
        {themes.slice(0, BASE_THEMES_COUNT).map((theme) => (
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
        {themes.slice(BASE_THEMES_COUNT).map((theme) => (
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
