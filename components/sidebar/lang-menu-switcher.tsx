"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { languages } from "@/lib/data/lang";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@mantine/hooks";
import { IconCircleFilled } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { type Locale, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { DropdownMenuContent, DropdownMenuItem } from "../ui/dropdown-menu";

export function LangMenuSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = useLocale();

  const queryClient = useQueryClient();

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

  function handleChangeLocale(locale: Locale) {
    if (currentLocale === locale) {
      return;
    }

    startTransition(async () => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params },
        { locale }
      );

      // reboot the pagefind because of the language change
      if (typeof window !== "undefined" && window.pagefind) {
        await window.pagefind.destroy?.();

        queryClient.invalidateQueries({ queryKey: ["search"] });
      }
    });
  }

  return (
    <DropdownMenuContent side={isMobile ? "top" : "right"} align="end">
      {languages.map((language) => (
        <DropdownMenuItem
          key={language.value}
          onMouseEnter={() => handlePrefetch(language.value)}
          onFocus={() => handlePrefetch(language.value)}
          onClick={() => handleChangeLocale(language.value)}
          disabled={isPending}
        >
          <span className="truncate">{language.label}</span>
          <IconCircleFilled
            className={cn(
              "ml-auto size-3 text-primary opacity-0 transition-opacity",
              currentLocale === language.value && "opacity-100"
            )}
          />
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}
