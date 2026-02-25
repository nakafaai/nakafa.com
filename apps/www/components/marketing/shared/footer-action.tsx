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
import { themes } from "@repo/design-system/lib/theme";
import { cn } from "@repo/design-system/lib/utils";
import { languages } from "@repo/internationalization/data/lang";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { IconCircleFilled } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import GB from "country-flag-icons/react/3x2/GB";
import ID from "country-flag-icons/react/3x2/ID";
import { useParams } from "next/navigation";
import { type Locale, useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ComponentProps, useTransition } from "react";

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

function Language() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = useLocale();

  const queryClient = useQueryClient();
  const t = useTranslations("Common");

  function handlePrefetch(locale: Locale) {
    router.prefetch(
      // @ts-expect-error -- TypeScript will validate that only known `params`
      // are used in combination with a given `pathname`. Since the two will
      // always match for the current route, we can skip runtime checks.
      { pathname, params },
      { locale }
    );
  }

  function handleChangeLocale(locale: Locale) {
    startTransition(async () => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params },
        { locale }
      );

      // reboot the pagefind because of the language change
      if (window?.pagefind) {
        await window.pagefind.destroy?.();

        queryClient.invalidateQueries({ queryKey: ["search"] });
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <HugeIcons icon={TranslateIcon} />
          <span className="truncate">{t("language")}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {languages.map((language) => {
          const Flag = flagMap[language.value];
          return (
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              key={language.value}
              onFocus={() => handlePrefetch(language.value)}
              onMouseEnter={() => handlePrefetch(language.value)}
              onSelect={(event) => {
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const BASE_THEMES_COUNT = 3;

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
      <DropdownMenuTrigger asChild>
        <Button variant={variant}>
          <HugeIcons icon={PaintBoardIcon} />
          <span className="truncate">{t("theme")}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-96">
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
              onSelect={(event) => {
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
