"use client";

import { TranslateIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { languages } from "@repo/internationalization/data/lang";
import { IconCircleFilled } from "@tabler/icons-react";
import { type Locale, useLocale, useTranslations } from "next-intl";
import { CountryFlagIcon } from "@/components/shared/country-flag";
import { useLocalizedRouteSwitch } from "@/lib/routing/locale/client";

/**
 * Switches the current marketing route between supported Nakafa locales.
 *
 * The compact label treatment keeps the header usable on narrow screens while
 * the footer preserves the full preference label.
 */
export function Language({ compact = false }: { compact?: boolean }) {
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
          <Button aria-label={t("language")} variant="outline">
            <HugeIcons icon={TranslateIcon} />
            <span className={cn("truncate", compact && "hidden sm:inline")}>
              {t("language")}
            </span>
          </Button>
        }
      />

      <DropdownMenuContent
        align="end"
        className="w-max max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          {languages.map((language) => (
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              key={language.value}
              onClick={(event) => {
                event.stopPropagation();
                handleChangeLocale(language.value);
              }}
            >
              <CountryFlagIcon countryCode={language.countryCode} />
              <span className="truncate">{language.label}</span>
              <IconCircleFilled
                className={cn(
                  "ml-auto size-3 text-primary opacity-0 transition-opacity",
                  currentLocale === language.value && "opacity-100"
                )}
              />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
