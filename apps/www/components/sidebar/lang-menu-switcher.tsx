"use client";

import { useMediaQuery } from "@mantine/hooks";
import {
  MenuGroup,
  MenuItem,
  MenuPopup,
} from "@repo/design-system/components/ui/menu";
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
import { type Locale, useLocale } from "next-intl";
import { useTransition } from "react";

const flagMap = {
  en: GB,
  id: ID,
};

/** Renders the sidebar language switcher menu. */
export function LangMenuSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = useLocale();

  const isMobile = useMediaQuery("(max-width: 640px)");

  function handlePrefetch(locale: Locale) {
    router.prefetch(
      // @ts-expect-error -- TypeScript will validate that only known `params`
      // are used in combination with a given `pathname`. Since the two will
      // always match for the current route, we can skip runtime checks.
      { pathname, params },
      { locale }
    );
  }

  /** Replaces the current route with the selected locale. */
  function handleChangeLocale(locale: Locale) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params },
        { locale }
      );
    });
  }

  return (
    <MenuPopup
      align="end"
      className="w-max max-w-[calc(100vw-2rem)]"
      side={isMobile ? "top" : "right"}
    >
      <MenuGroup>
        {languages.map((language) => {
          const Flag = flagMap[language.value];
          return (
            <MenuItem
              disabled={isPending}
              key={language.value}
              onClick={() => handleChangeLocale(language.value)}
              onFocus={() => handlePrefetch(language.value)}
              onMouseEnter={() => handlePrefetch(language.value)}
            >
              <Flag className="size-4 shrink-0" />
              <span className="truncate">{language.label}</span>
              <IconCircleFilled
                className={cn(
                  "ml-auto size-3 text-primary opacity-0 transition-opacity",
                  currentLocale === language.value && "opacity-100"
                )}
              />
            </MenuItem>
          );
        })}
      </MenuGroup>
    </MenuPopup>
  );
}
