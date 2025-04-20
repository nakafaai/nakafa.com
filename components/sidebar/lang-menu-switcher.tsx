"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { type Locale, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { useMediaQuery } from "usehooks-ts";
import { DropdownMenuContent, DropdownMenuItem } from "../ui/dropdown-menu";

export function LangMenuSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = useLocale();

  const isMobile = useMediaQuery("(max-width: 640px)");

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
      }
    });
  }

  return (
    <DropdownMenuContent side={isMobile ? "top" : "right"} align="end">
      <DropdownMenuItem
        onClick={() => handleChangeLocale("id")}
        disabled={isPending}
      >
        <span className="truncate">Indonesia</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => handleChangeLocale("en")}
        disabled={isPending}
      >
        <span className="truncate">English</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
