"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { languages } from "@/lib/data/lang";
import { cn } from "@/lib/utils";
import { IconCircleFilled } from "@tabler/icons-react";
import { LanguagesIcon } from "lucide-react";
import { type Locale, useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DropdownMenu } from "../ui/dropdown-menu";

export function LangSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = useLocale();

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
    if (currentLocale === locale) {
      return;
    }

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
    </DropdownMenu>
  );
}
