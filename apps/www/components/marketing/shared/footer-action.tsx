"use client";

import { PaintBoardIcon, TranslateIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { themeOptions } from "@repo/design-system/lib/theme-options";
import { cn } from "@repo/design-system/lib/utils";
import { languages } from "@repo/internationalization/data/lang";
import { IconCircleFilled } from "@tabler/icons-react";
import GB from "country-flag-icons/react/3x2/GB";
import ID from "country-flag-icons/react/3x2/ID";
import { type Locale, useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useLocalizedRouteSwitch } from "@/lib/routing/locale/client";

/** Renders footer preference actions that share the same language route resolver as the sidebar. */
export function FooterAction() {
  return (
    <ButtonGroup>
      <Language />
      <Theme />
    </ButtonGroup>
  );
}

const flagMap = {
  en: GB,
  id: ID,
};

/** Renders the footer language switcher and keeps localized route projection outside the UI list. */
function Language() {
  const { isPending, replace } = useLocalizedRouteSwitch();
  const currentLocale = useLocale();
  const t = useTranslations("Common");

  /** Replaces the current route with the selected locale. */
  function handleChangeLocale(locale: Locale) {
    replace(locale);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline">
            <HugeIcons icon={TranslateIcon} />
            <span className="truncate">{t("language")}</span>
          </Button>
        }
      />

      <DropdownMenuContent
        align="end"
        className="w-max max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          {languages.map((language) => {
            const Flag = flagMap[language.value];
            return (
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={isPending}
                key={language.value}
                onClick={(event) => {
                  event.stopPropagation();
                  handleChangeLocale(language.value);
                }}
              >
                <Flag className="size-4 shrink-0" />
                <span className="truncate">{language.label}</span>
                <IconCircleFilled
                  className={cn(
                    "ml-auto size-3 text-primary opacity-0 transition-opacity",
                    currentLocale === language.value && "opacity-100"
                  )}
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const BASE_THEMES_COUNT = 3;

/** Renders the footer theme selector while leaving the selected theme in next-themes. */
export function Theme({
  variant = "outline",
}: {
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const t = useTranslations("Common");
  const { theme: currentTheme, setTheme } = useTheme();

  function isActive(value: string) {
    return currentTheme === value;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant={variant}>
            <HugeIcons icon={PaintBoardIcon} />
            <span className="truncate">{t("theme")}</span>
          </Button>
        }
      />

      <DropdownMenuContent
        align="end"
        className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-2rem)]"
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
              <CheckerBadge isActive={isActive(theme.value)} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {themeOptions.slice(BASE_THEMES_COUNT).map((theme) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={theme.value}
              onClick={(event) => {
                event.stopPropagation();
                setTheme(theme.value);
              }}
            >
              <HugeIcons className="shrink-0" icon={theme.icon} />
              <span className="truncate">{t(theme.value)}</span>
              <CheckerBadge isActive={isActive(theme.value)} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shows the selected dropdown item without affecting the item hit target. */
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
