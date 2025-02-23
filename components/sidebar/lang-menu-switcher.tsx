"use client";

import { type Locale, usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { DropdownMenuContent, DropdownMenuItem } from "../ui/dropdown-menu";

export function LangMenuSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();

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
    <DropdownMenuContent side="right">
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
