"use client";

import { useMediaQuery } from "@mantine/hooks";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@repo/design-system/components/ui/dropdown-menu";
import { cn } from "@repo/design-system/lib/utils";
import { languages } from "@repo/internationalization/data/lang";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { IconCircleFilled } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { type Locale, useLocale } from "next-intl";
import { useTransition } from "react";

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
    <DropdownMenuContent align="end" side={isMobile ? "top" : "right"}>
      {languages.map((language) => (
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={isPending}
          key={language.value}
          onFocus={() => handlePrefetch(language.value)}
          onMouseEnter={() => handlePrefetch(language.value)}
          onSelect={() => handleChangeLocale(language.value)}
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
