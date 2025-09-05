"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { cn } from "@repo/design-system/lib/utils";
import { languages } from "@repo/internationalization/data/lang";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { IconCircleFilled } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { LanguagesIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { type Locale, useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

export function LangSwitcher() {
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

      if (typeof window !== "undefined" && window.pagefind) {
        // reboot the pagefind because of the language change
        await window.pagefind.destroy?.();

        queryClient.invalidateQueries({ queryKey: ["search"] });
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <LanguagesIcon />
          <span className="truncate">{t("language")}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            disabled={isPending}
            key={language.value}
            onClick={() => handleChangeLocale(language.value)}
            onFocus={() => handlePrefetch(language.value)}
            onMouseEnter={() => handlePrefetch(language.value)}
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
    </DropdownMenu>
  );
}
