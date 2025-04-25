"use client";

import { usePathname } from "@/i18n/routing";
import { languages } from "@/lib/data/lang";
import { cn } from "@/lib/utils";
import { IconCircleFilled } from "@tabler/icons-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useMediaQuery } from "usehooks-ts";
import { DropdownMenuContent, DropdownMenuItem } from "../ui/dropdown-menu";

export function LangMenuSwitcher() {
  const pathname = usePathname();
  const currentLocale = useLocale();

  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <DropdownMenuContent side={isMobile ? "top" : "right"} align="end">
      {languages.map((language) => (
        <DropdownMenuItem
          key={language.value}
          onClick={async () => {
            if (currentLocale === language.value) {
              return;
            }

            // reboot the pagefind because of the language change
            if (typeof window !== "undefined" && window.pagefind) {
              await window.pagefind.destroy?.();
            }
          }}
          asChild
        >
          <Link href={`/${language.value}${pathname}`} prefetch replace>
            <span className="truncate">{language.label}</span>
            <IconCircleFilled
              className={cn(
                "ml-auto size-3 text-primary opacity-0 transition-opacity",
                currentLocale === language.value && "opacity-100"
              )}
            />
          </Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}
