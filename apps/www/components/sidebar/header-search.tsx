"use client";

import { useSearch } from "@/lib/context/use-search";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { usePathname } from "@repo/internationalization/src/navigation";
import { IconCommand, IconLetterK } from "@tabler/icons-react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

export function HeaderSearch() {
  const pathname = usePathname();
  const t = useTranslations("Utils");
  const id = useId();

  const setOpen = useSearch((state) => state.setOpen);

  if (pathname === "/" || pathname === "/search") {
    return null;
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
      type="button"
      className="w-full cursor-pointer sm:w-auto"
    >
      <Label htmlFor={id} className="sr-only">
        {t("search")}
      </Label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3">
          <SearchIcon className="size-4 text-muted-foreground" />
        </div>
        <Input
          id={id}
          className="pointer-events-none h-8 border border-border bg-background pl-9 shadow-xs transition-colors placeholder:text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-0 sm:w-80 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
          placeholder={t("search-bar-placeholder")}
          type="text"
        />
        <div className="pointer-events-none absolute inset-y-0 end-0 hidden items-center justify-center pe-3 lg:flex">
          <div className="flex items-center gap-1">
            <kbd className="rounded border bg-background p-0.75">
              <IconCommand className="size-3 shrink-0" />
              <span className="sr-only">Command/Ctrl</span>
            </kbd>
            <kbd className="rounded border bg-background p-0.75">
              <IconLetterK className="size-3 shrink-0" />
              <span className="sr-only">K</span>
            </kbd>
          </div>
        </div>
      </div>
    </button>
  );
}
